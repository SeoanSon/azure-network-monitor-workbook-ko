export const subscriptionFilter = (expression = 'subscriptionId') =>
  `| where ${expression} in~ ({Subscriptions}) or strcat('/subscriptions/', ${expression}) in~ ({Subscriptions})`;

export const scope = `${subscriptionFilter()}
| where '*' in ({ResourceGroups}) or resourceGroup in~ ({ResourceGroups})`;

export const types = [
  'microsoft.network/virtualnetworkgateways',
  'microsoft.network/connections',
  'microsoft.network/expressroutecircuits',
  'microsoft.network/virtualnetworks',
];

export const inventory = `Resources
| where type in~ (${types.map(type => `'${type}'`).join(', ')})
${scope}
| extend ['종류'] = case(type =~ 'microsoft.network/virtualnetworkgateways', strcat(tostring(properties.gatewayType), ' Gateway'),
    type =~ 'microsoft.network/connections', '게이트웨이 연결',
    type =~ 'microsoft.network/expressroutecircuits', 'ExpressRoute 회선', '가상 네트워크')
| project ['리소스'] = name, ['종류'], ['배포 상태'] = tostring(properties.provisioningState),
    ['지역'] = location, ['리소스 그룹'] = resourceGroup, ['구독'] = subscriptionId, id
| order by ['종류'] asc, ['리소스'] asc`;

export const summary = `Resources
| where type in~ (${types.map(type => `'${type}'`).join(', ')})
${scope}
| extend ['종류'] = case(type =~ 'microsoft.network/virtualnetworkgateways', strcat(tostring(properties.gatewayType), ' Gateway'),
    type =~ 'microsoft.network/connections', '게이트웨이 연결',
    type =~ 'microsoft.network/expressroutecircuits', 'ExpressRoute 회선', '가상 네트워크')
| summarize ['리소스 수'] = count(), ['배포 상태 확인 필요'] = countif(tostring(properties.provisioningState) != 'Succeeded') by ['종류']
| order by ['종류'] asc`;

export const connections = `Resources
| where type =~ 'microsoft.network/connections'
${scope}
| project ['연결'] = name, ['유형'] = tostring(properties.connectionType),
    ['연결 상태'] = tostring(properties.connectionStatus),
    ['배포 상태'] = tostring(properties.provisioningState),
    ['게이트웨이'] = tostring(properties.virtualNetworkGateway1.id),
    ['BGP 사용'] = tostring(properties.enableBgp),
    ['원격 게이트웨이'] = tostring(properties.localNetworkGateway2.id),
    ['회선'] = tostring(properties.peer.id), ['리소스 그룹'] = resourceGroup, id
| order by ['연결 상태'] asc, ['연결'] asc`;

export const vpnInventory = `Resources
| where type =~ 'microsoft.network/virtualnetworkgateways' and properties.gatewayType =~ 'Vpn'
${scope}
| project ['게이트웨이'] = name, ['SKU'] = tostring(properties.sku.name),
    ['VPN 유형'] = tostring(properties.vpnType), ['활성-활성'] = tostring(properties.activeActive),
    ['BGP 사용'] = tostring(properties.enableBgp), ['ASN'] = tostring(properties.bgpSettings.asn),
    ['배포 상태'] = tostring(properties.provisioningState), ['지역'] = location, id
| order by ['게이트웨이'] asc`;

export const circuitInventory = `Resources
| where type =~ 'microsoft.network/expressroutecircuits'
${scope}
| project ['회선'] = name, ['공급자'] = tostring(properties.serviceProviderProperties.serviceProviderName),
    ['피어링 위치'] = tostring(properties.serviceProviderProperties.peeringLocation),
    ['대역폭 Mbps'] = toint(properties.serviceProviderProperties.bandwidthInMbps),
    ['공급자 프로비저닝'] = tostring(properties.serviceProviderProvisioningState),
    ['회선 상태'] = tostring(properties.circuitProvisioningState),
    ['배포 상태'] = tostring(properties.provisioningState), ['SKU'] = tostring(sku.name), id
| order by ['회선'] asc`;

export const circuitPeerings = `Resources
| where type =~ 'microsoft.network/expressroutecircuits'
${scope}
| where id =~ '{Circuit}'
| mv-expand peering = properties.peerings
| project ['회선'] = name, ['피어링'] = tostring(peering.name),
    ['유형'] = tostring(peering.properties.peeringType), ['상태'] = tostring(peering.properties.state),
    ['피어 ASN'] = tostring(peering.properties.peerASN), ['Azure ASN'] = tostring(peering.properties.azureASN),
    ['기본 접두사'] = tostring(peering.properties.primaryPeerAddressPrefix),
    ['보조 접두사'] = tostring(peering.properties.secondaryPeerAddressPrefix),
    ['VLAN'] = toint(peering.properties.vlanId)
| order by ['피어링'] asc`;

export const peerings = `Resources
| where type =~ 'microsoft.network/virtualnetworks'
${scope}
| mv-expand peering = properties.virtualNetworkPeerings
| extend State = tostring(peering.properties.peeringState),
    Sync = tostring(peering.properties.peeringSyncLevel)
| extend ['확인'] = case(State != 'Connected', '확인 필요: 미연결 또는 상태 없음',
    isnotempty(Sync) and Sync != 'FullyInSync', '확인 필요: 주소 공간 동기화',
    isempty(Sync), '연결됨: 동기화 상태 미보고', '연결됨: 구성 기준')
| project ['로컬 VNet'] = name, ['피어링'] = tostring(peering.name), ['확인'],
    ['피어링 상태'] = State, ['동기화 상태'] = Sync,
    ['원격 VNet'] = tostring(peering.properties.remoteVirtualNetwork.id),
    ['VNet 액세스'] = tostring(peering.properties.allowVirtualNetworkAccess),
    ['전달 트래픽 허용'] = tostring(peering.properties.allowForwardedTraffic),
    ['게이트웨이 전송 허용'] = tostring(peering.properties.allowGatewayTransit),
    ['원격 게이트웨이 사용'] = tostring(peering.properties.useRemoteGateways),
    ['리소스 그룹'] = resourceGroup, ['구독'] = subscriptionId,
    id = tostring(peering.id)
| order by ['확인'] asc, ['로컬 VNet'] asc, ['피어링'] asc`;

const logScope = `| where TimeGenerated {TimeRange}
${subscriptionFilter("tostring(split(_ResourceId, '/')[2])")}
| where '*' in ({ResourceGroups}) or tostring(split(_ResourceId, '/')[4]) in~ ({ResourceGroups})`;

export const diagnosticsBase = `let NetworkLogs = union isfuzzy=true
    (datatable(TimeGenerated:datetime, _ResourceId:string, ResourceProvider:string, Category:string, Message:string) []),
    AzureDiagnostics
${logScope}
| where ResourceProvider =~ 'MICROSOFT.NETWORK'
| where Category in ('GatewayDiagnosticLog', 'TunnelDiagnosticLog', 'RouteDiagnosticLog', 'IKEDiagnosticLog', 'P2SDiagnosticLog', 'PeeringRouteLog')
| extend ['메시지'] = coalesce(tostring(column_ifexists('msg_s', '')), tostring(column_ifexists('Message', '')), tostring(column_ifexists('message_s', '')), tostring(column_ifexists('properties_s', '')))
| extend ['리소스 ID'] = _ResourceId;`;

export const diagnosticsCoverage = `${diagnosticsBase}
NetworkLogs
| summarize ['로그 수'] = count(), ['마지막 수집 UTC'] = max(TimeGenerated)
| extend ['수집 확인'] = iff(['로그 수'] == 0,
    '데이터 없음: 시간 범위·권한·진단 설정·작업 영역을 확인하세요. 정상 상태를 의미하지 않습니다.',
    '선택 범위에서 로그가 수집되었습니다. 로그 존재만으로 정상 상태를 판정하지 않습니다.')`;

export const diagnosticsTimeline = `${diagnosticsBase}
NetworkLogs
| summarize ['이벤트 수'] = count() by bin(TimeGenerated, {TimeRange:grain}), Category
| order by TimeGenerated asc`;

export const diagnosticsRecent = `${diagnosticsBase}
NetworkLogs
| project ['시간 UTC'] = TimeGenerated, ['범주'] = Category, ['리소스 ID'], ['메시지']
| order by ['시간 UTC'] desc
| take 250`;

export const selectedVpnLogs = `${diagnosticsBase}
NetworkLogs
| where _ResourceId =~ '{VpnGateway}'
| project ['시간 UTC'] = TimeGenerated, ['범주'] = Category, ['메시지']
| order by ['시간 UTC'] desc
| take 100`;

const vpnS2sBase = `union isfuzzy=true
    (datatable(TimeGenerated:datetime, _ResourceId:string, ResourceId:string, Category:string, Message:string) []),
    AzureDiagnostics
| extend _ResourceId = coalesce(tostring(column_ifexists('_ResourceId', '')), tostring(column_ifexists('ResourceId', '')))
${logScope}
| where isnotempty('{VpnGateway}') and _ResourceId =~ '{VpnGateway}'
| extend Category = tostring(column_ifexists('Category', '')),
    OperationName = tostring(column_ifexists('OperationName', '')),
    Gateway = coalesce(tostring(column_ifexists('Resource', '')), tostring(split(_ResourceId, '/')[8])),
    remoteIP_s = tostring(column_ifexists('remoteIP_s', '')),
    instance_s = tostring(column_ifexists('instance_s', '')),
    Message = coalesce(tostring(column_ifexists('Message', '')), tostring(column_ifexists('msg_s', '')), tostring(column_ifexists('message_s', '')), tostring(column_ifexists('properties_s', ''))),
    Level = tostring(column_ifexists('Level', ''))`;

const vpnTunnelBase = `${vpnS2sBase}
| where Category == 'TunnelDiagnosticLog'
| where OperationName in ('TunnelConnected', 'TunnelDisconnected')
| extend Peer = iff(isempty(remoteIP_s), '(피어 정보 없음)', remoteIP_s),
    Instance = iff(isempty(instance_s), '(인스턴스 정보 없음)', instance_s)`;

const vpnIkeBase = `${vpnS2sBase}
| where Category == 'IKEDiagnosticLog'
| extend Peer = iff(isempty(remoteIP_s), '(원문에서 피어 확인)', remoteIP_s),
    Instance = iff(isempty(instance_s), '(인스턴스 정보 없음)', instance_s)`;

export const dpdPatterns = {
  dpd: String.raw`\b(dpd|dead\s+peer\s+detection)\b`,
  timeout: String.raw`\b(timeout|timed[\s-]*out|time-out|no\s+response|not\s+responding|retry\s+limit|retransmi[a-z]*\s+(limit\s+)?(exceeded|exhausted)|peer\s+unreachable|timer\s+expired)\b`,
  failure: String.raw`\b(failed|failure|unresponsive)\b`,
  nonEvent: String.raw`\b(config[a-z]*|setting[s]?|interval)\b|\bno\s+(dpd\s+)?(timeout|failure)\b|\b(timeout|failure)\s+(not\s+detected|disabled)\b`,
};

export const vpnIkeClassification = `| extend Text = tolower(Message)
| extend HasDpd = Text matches regex @'${dpdPatterns.dpd}',
    HasTimeout = Text matches regex @'${dpdPatterns.timeout}',
    HasFailure = Text matches regex @'${dpdPatterns.failure}',
    NonEvent = Text matches regex @'${dpdPatterns.nonEvent}'
| extend Signal = case(
    not(NonEvent) and HasDpd and HasTimeout, 'DPD 시간 초과 의심 (문자열 휴리스틱)',
    not(NonEvent) and HasDpd and HasFailure, 'DPD 실패 의심 (문자열 휴리스틱)',
    not(NonEvent) and not(HasDpd) and (HasTimeout or HasFailure), '기타 IKE 시간 초과·실패 관련 (DPD 미확인)',
    '')`;

export const vpnS2sCoverage = `${vpnS2sBase}
| where Category in ('TunnelDiagnosticLog', 'IKEDiagnosticLog', 'GatewayDiagnosticLog')
| summarize TunnelRows = countif(Category == 'TunnelDiagnosticLog'),
    IkeRows = countif(Category == 'IKEDiagnosticLog'),
    GatewayRows = countif(Category == 'GatewayDiagnosticLog'),
    FirstSeenUtc = min(TimeGenerated), LastSeenUtc = max(TimeGenerated)
| extend CoverageNote = iff(TunnelRows == 0 or IkeRows == 0,
    '터널/IKE 미관측: 지원 범주·진단 설정·작업 영역·기간·수집 지연·권한 확인. 정상 판정 불가.',
    '기간 내 터널/IKE 로그 관측. 수집 완전성·현재 상태·DPD 원인 확정 불가.')`;

export const vpnS2sTunnelTrend = `${vpnTunnelBase}
| summarize Events = count() by bin(TimeGenerated, {TimeRange:grain}), OperationName, Peer, Instance
| extend Series = strcat(OperationName, ' | ', Peer, ' | ', Instance)
| project TimeGenerated, Series, Events
| order by TimeGenerated asc`;

export const vpnS2sTunnelSummary = `${vpnTunnelBase}
| summarize ConnectedEvents = countif(OperationName == 'TunnelConnected'),
    DisconnectedEvents = countif(OperationName == 'TunnelDisconnected'),
    FirstEventUtc = min(TimeGenerated), LastEventUtc = max(TimeGenerated)
    by Gateway, _ResourceId, Peer, Instance
| order by DisconnectedEvents desc, LastEventUtc desc`;

export const vpnS2sTunnelEvents = `${vpnTunnelBase}
| top 1000 by TimeGenerated desc
| project TimeGenerated, Gateway, Peer, Instance, OperationName, Message, _ResourceId
| order by TimeGenerated asc`;

export const vpnS2sDpdTrend = `${vpnIkeBase}
${vpnIkeClassification}
| where isnotempty(Signal)
| summarize Events = count() by bin(TimeGenerated, {TimeRange:grain}), Signal, Peer, Instance
| extend Series = strcat(Signal, ' | ', Peer, ' | ', Instance)
| project TimeGenerated, Series, Events
| order by TimeGenerated asc`;

export const vpnS2sDpdEvents = `${vpnIkeBase}
${vpnIkeClassification}
| where isnotempty(Signal)
| top 1000 by TimeGenerated desc
| project TimeGenerated, Gateway, Peer, Instance, Signal, Level, OperationName, Message, _ResourceId
| order by TimeGenerated asc`;

export const vpnS2sIkeRaw = `${vpnIkeBase}
| top 1000 by TimeGenerated desc
| project TimeGenerated, Gateway, Peer, Instance, Level, OperationName, Message, _ResourceId
| order by TimeGenerated asc`;

export const vpnS2sGatewayEvents = `${vpnS2sBase}
| where Category == 'GatewayDiagnosticLog'
| top 1000 by TimeGenerated desc
| project TimeGenerated, Gateway, instance_s, OperationName, Message, _ResourceId
| order by TimeGenerated asc`;

export const selectedCircuitLogs = `${diagnosticsBase}
NetworkLogs
| where _ResourceId =~ '{Circuit}' and Category == 'PeeringRouteLog'
| project ['시간 UTC'] = TimeGenerated, ['범주'] = Category, ['메시지']
| order by ['시간 UTC'] desc
| take 100`;

export const activityBase = `let Changes = union isfuzzy=true
    (datatable(TimeGenerated:datetime, _ResourceId:string, ResourceId:string, ResourceProviderValue:string, OperationNameValue:string, ActivityStatusValue:string, Caller:string, CorrelationId:string) []),
    AzureActivity
| extend _ResourceId = coalesce(_ResourceId, ResourceId)
${logScope}
| where ResourceProviderValue =~ 'MICROSOFT.NETWORK'
| where _ResourceId has_any ('virtualNetworkGateways', 'connections', 'expressRouteCircuits', 'virtualNetworks');`;

export const activityCoverage = `${activityBase}
Changes
| summarize ['변경 이벤트 수'] = count(), ['마지막 수집 UTC'] = max(TimeGenerated)
| extend ['수집 확인'] = iff(['변경 이벤트 수'] == 0,
    '데이터 없음: 구독 활동 로그 내보내기·시간 범위·권한을 확인하세요. 변경 없음으로 단정할 수 없습니다.',
    '선택 범위의 네트워크 활동 로그가 수집되었습니다.')`;

export const activityRecent = `${activityBase}
Changes
| project ['시간 UTC'] = TimeGenerated, ['작업'] = OperationNameValue,
    ['상태'] = ActivityStatusValue, ['호출자'] = Caller,
    ['리소스 ID'] = _ResourceId, ['상관 ID'] = CorrelationId
| order by ['시간 UTC'] desc
| take 250`;

export const connectivityBase = `let Tests = union isfuzzy=true
    (datatable(TimeGenerated:datetime, _ResourceId:string, ConnectionMonitorResourceId:string,
        SourceName:string, DestinationName:string, TestGroupName:string, TestConfigurationName:string,
        ChecksFailed:int, ChecksTotal:int, AvgRoundTripTimeMs:real, TestResult:string) []),
    NWConnectionMonitorTestResult
| extend _ResourceId = coalesce(ConnectionMonitorResourceId, _ResourceId)
${logScope};`;

export const connectivityCoverage = `${connectivityBase}
Tests
| summarize ['결과 수'] = count(), ['마지막 측정 UTC'] = max(TimeGenerated)
| extend ['측정 확인'] = iff(['결과 수'] == 0,
    '측정 없음: Connection Monitor와 에이전트, 대상 작업 영역을 설정하세요. 피어링의 실제 통신 정상 여부는 알 수 없습니다.',
    '실제 측정 결과가 있습니다. 대상 경로가 해당 피어링을 사용하는지 별도 확인하세요.')`;

export const connectivity = `${connectivityBase}
Tests
| summarize ['실패 검사 수'] = sum(ChecksFailed), ['전체 검사 수'] = sum(ChecksTotal),
    ['평균 RTT ms'] = iff(sumif(ChecksTotal, isnotnull(AvgRoundTripTimeMs)) > 0,
        sum(AvgRoundTripTimeMs * ChecksTotal) / sumif(ChecksTotal, isnotnull(AvgRoundTripTimeMs)), real(null)),
    ['마지막 측정 UTC'] = max(TimeGenerated)
    by ['모니터 ID'] = _ResourceId, ['테스트 그룹'] = TestGroupName,
        ['테스트 구성'] = TestConfigurationName, ['원본'] = SourceName, ['대상'] = DestinationName
| extend ['실패율 %'] = iff(['전체 검사 수'] > 0, round(100.0 * ['실패 검사 수'] / ['전체 검사 수'], 2), real(null))
| order by ['실패율 %'] desc`;
