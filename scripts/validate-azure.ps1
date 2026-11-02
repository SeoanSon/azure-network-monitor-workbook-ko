[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ResourceGroup,
    [string]$WorkspaceResourceId = '',
    [switch]$RunFixtureTests
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Invoke-AzJson {
    param([string[]]$Arguments)
    $result = & az @Arguments --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI validation failed: $($Arguments[0..1] -join ' ')" }
    return ($result -join "`n" | ConvertFrom-Json)
}

function Get-WorkbookNodes {
    param($Items)
    foreach ($item in $Items) {
        $item
        if ($item.content.items) { Get-WorkbookNodes $item.content.items }
    }
}

function Invoke-JsonRequest {
    param([string]$Uri, $Body, [string]$Resource = 'https://management.azure.com/')
    $path = [System.IO.Path]::GetTempFileName()
    $responsePath = [System.IO.Path]::GetTempFileName()
    try {
        $json = $Body | ConvertTo-Json -Depth 30 -Compress
        [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
        # Windows Azure CLI stdout can use a legacy code page; preserve Korean JSON through the response file.
        & az rest --method post --uri $Uri --resource $Resource --body "@$path" --output-file $responsePath --output none
        if ($LASTEXITCODE -ne 0) { throw "Azure REST validation failed: $Uri" }
        return ([System.IO.File]::ReadAllText($responsePath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json)
    }
    finally {
        Remove-Item -LiteralPath $path
        Remove-Item -LiteralPath $responsePath
    }
}

$account = Invoke-AzJson @('account', 'show')
$subscription = $account.id
$validation = Invoke-AzJson @(
    'deployment', 'group', 'validate', '--resource-group', $ResourceGroup,
    '--template-file', (Join-Path $root 'azuredeploy.json'), '--validation-level', 'ProviderNoRbac'
)
if ($validation.error -or $validation.properties.error) { throw 'ARM provider validation returned an error.' }
Write-Host 'PASS ARM provider validation (no resource deployment)'

$workbook = Get-Content (Join-Path $root 'network-monitor.workbook') -Raw | ConvertFrom-Json
$nodes = @(Get-WorkbookNodes $workbook.items)
$checks = @()
foreach ($node in $nodes) {
    if ($node.type -eq 3 -and $node.content.queryType -eq 1) {
        $checks += @{ name = $node.name; query = $node.content.query }
    }
    foreach ($parameter in $node.content.parameters) {
        if ($parameter.queryType -eq 1 -and $parameter.query) {
            $checks += @{ name = "parameter-$($parameter.name)"; query = $parameter.query }
        }
    }
}

function Expand-WorkbookQuery {
    param([string]$Query)
    return $Query.Replace('{Subscriptions}', "'$subscription'").
        Replace('{ResourceGroups}', "'*'").
        Replace('{Circuit}', "/subscriptions/$subscription/resourceGroups/workbook-validation/providers/Microsoft.Network/expressRouteCircuits/not-deployed").
        Replace('{VpnGateway}', "/subscriptions/$subscription/resourceGroups/workbook-validation/providers/Microsoft.Network/virtualNetworkGateways/not-deployed").
        Replace('{TimeRange:grain}', '1h').
        Replace('{TimeRange}', '> ago(1d)')
}

foreach ($check in $checks) {
    $query = Expand-WorkbookQuery $check.query
    $result = Invoke-JsonRequest 'https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01' @{
        subscriptions = @($subscription); query = $query; options = @{ '$top' = 1000 }
    }
    Write-Host "PASS Resource Graph $($check.name) ($($result.count) rows)"
}

if ($WorkspaceResourceId) {
    $workspace = Invoke-AzJson @('resource', 'show', '--ids', $WorkspaceResourceId, '--api-version', '2022-10-01')
    $workspaceId = $workspace.properties.customerId
    if (-not $workspaceId) { throw 'The supplied resource is not a Log Analytics workspace.' }
    foreach ($node in $nodes | Where-Object { $_.type -eq 3 -and $_.content.queryType -eq 0 }) {
        $result = Invoke-JsonRequest "https://api.loganalytics.azure.com/v1/workspaces/$workspaceId/query" @{
            query = (Expand-WorkbookQuery $node.content.query); timespan = 'P1D'
        } 'https://api.loganalytics.io'
        if ($result.error) { throw "Log query error ($($node.name)): $($result.error | ConvertTo-Json -Depth 10)" }
        Write-Host "PASS Log Analytics $($node.name)"
    }
    if ($RunFixtureTests) {
        $gateway = "/subscriptions/$subscription/resourceGroups/workbook-validation/providers/Microsoft.Network/virtualNetworkGateways/synthetic"
        $monitor = "/subscriptions/$subscription/resourceGroups/workbook-validation/providers/Microsoft.Network/networkWatchers/region/connectionMonitors/synthetic"
        $fixtures = @(
            @{
                name = 'diagnostics-scope-and-message'
                panel = 'diagnostics-recent'
                prefix = "let AzureDiagnostics = datatable(Suffix:string, ResourceProvider:string, Category:string, msg_s:string) ['', 'MICROSOFT.NETWORK', 'TunnelDiagnosticLog', 'synthetic', '-excluded', 'MICROSOFT.NETWORK', 'TunnelDiagnosticLog', 'excluded'] | extend TimeGenerated=now(), _ResourceId=replace_string('$gateway', 'workbook-validation/', strcat('workbook-validation', Suffix, '/'));"
                verify = {
                    param($Table)
                    if ($Table.rows.Count -ne 1 -or $Table.rows[0][2] -ne $gateway -or $Table.rows[0][3] -ne 'synthetic') {
                        throw 'Expected one in-scope diagnostic row with normalized msg_s.'
                    }
                }
            },
            @{
                name = 'empty-diagnostics-is-not-healthy'
                panel = 'diagnostics-coverage'
                prefix = 'let AzureDiagnostics = datatable(TimeGenerated:datetime, _ResourceId:string, ResourceProvider:string, Category:string, Message:string) [];'
                verify = {
                    param($Table)
                    if ($Table.rows.Count -ne 1 -or $Table.rows[0][0] -ne 0 -or $Table.rows[0][2] -notlike '*데이터 없음*') {
                        throw "Missing diagnostics must be reported explicitly, not as healthy. Synthetic result: $($Table | ConvertTo-Json -Depth 8 -Compress)"
                    }
                }
            },
            @{
                name = 'weighted-connectivity-and-zero-checks'
                panel = 'connectivity'
                prefix = "let NWConnectionMonitorTestResult = datatable(TestConfigurationName:string, ChecksFailed:int, ChecksTotal:int, AvgRoundTripTimeMs:real) ['weighted', 1, 10, 10.0, 'weighted', 4, 30, 30.0, 'weighted', 0, 100, real(null), 'zero', 0, 0, real(null)] | extend TimeGenerated=now(), _ResourceId='$monitor', ConnectionMonitorResourceId='$monitor', SourceName='source', DestinationName='destination', TestGroupName='group';"
                verify = {
                    param($Table)
                    $names = @($Table.columns | ForEach-Object { $_.name })
                    $config = $names.IndexOf('테스트 구성')
                    $rate = $names.IndexOf('실패율 %')
                    $rtt = $names.IndexOf('평균 RTT ms')
                    $total = $names.IndexOf('전체 검사 수')
                    $weighted = @($Table.rows | Where-Object { $_[$config] -eq 'weighted' })
                    $zero = @($Table.rows | Where-Object { $_[$config] -eq 'zero' })
                    if ($weighted.Count -ne 1 -or $weighted[0][$rate] -ne 3.57 -or $weighted[0][$rtt] -ne 25 -or $weighted[0][$total] -ne 140) {
                        throw 'Weighted failure rate/RTT did not match the synthetic 140-check result.'
                    }
                    if ($zero.Count -ne 1 -or $null -ne $zero[0][$rate] -or $null -ne $zero[0][$rtt]) {
                        throw 'Zero checks must produce null failure rate and null RTT.'
                    }
                }
            }
        )
        foreach ($fixture in $fixtures) {
            $panel = $nodes | Where-Object name -eq $fixture.panel
            $query = $panel.content.query.Replace('{ResourceGroups}', "'workbook-validation'")
            $result = Invoke-JsonRequest "https://api.loganalytics.azure.com/v1/workspaces/$workspaceId/query" @{
                query = $fixture.prefix + "`n" + (Expand-WorkbookQuery $query); timespan = 'P1D'
            } 'https://api.loganalytics.io'
            if ($result.error) { throw "Fixture query error: $($fixture.name)" }
            & $fixture.verify $result.tables[0]
            Write-Host "PASS Log Analytics fixture $($fixture.name)"
        }
    }
}
else {
    if ($RunFixtureTests) { throw '-RunFixtureTests requires -WorkspaceResourceId.' }
    Write-Warning 'Log Analytics queries were not executed. Supply -WorkspaceResourceId to validate them.'
}
Write-Warning 'Native VPN/ExpressRoute metrics and portal rendering still require target network resources and portal verification.'
