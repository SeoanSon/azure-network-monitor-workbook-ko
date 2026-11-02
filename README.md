# Azure 통합 네트워크 모니터링 Workbook (한국어)

**VPN Gateway · VNet Peering · ExpressRoute**의 구성·성능·진단·변경을 한곳에서 조회하는 Azure Monitor Workbook입니다.

[Azure Firewall Monitor Workbook](https://github.com/Azure/Azure-Network-Security/tree/1f98d7a10514817932abdff168ea28ec5cfa847c/Azure%20Firewall/Workbook%20-%20Azure%20Firewall%20Monitor%20Workbook)을 기반으로 한국어로 재구성했습니다. 원본은 변경하지 않았으며, [원본 스냅샷](upstream/)과 [MIT 라이선스](LICENSE)를 보존합니다. Microsoft 공식 지원 배포판이 아닙니다.

## Azure에 바로 배포

[![Azure에 배포](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2FSeoanSon%2Fazure-network-monitor-workbook-ko%2Fmain%2Fazuredeploy.json)

> **생성되는 리소스는 공유 Workbook 하나뿐입니다.** 기존 VPN·VNet·피어링·ExpressRoute·라우팅·진단 설정을 만들거나 변경하지 않습니다. Log Analytics 작업 영역·에이전트·Connection Monitor·경고 규칙도 자동 생성하지 않습니다.

1. 위 버튼을 누르고 **구독·리소스 그룹·지역**을 선택합니다.
2. Workbook 표시 이름을 지정합니다.
3. 로그가 필요하면 `workspaceResourceId`에 **기존** Log Analytics 작업 영역의 전체 리소스 ID를 입력합니다. 모르면 비워 두고 배포 후 선택할 수 있습니다.
4. 검토 및 만들기를 완료합니다.
5. 배포 출력의 `workbookPortalUrl` 또는 **Azure Monitor → 통합 문서 → 내 통합 문서**에서 엽니다.
6. 조회 구독·리소스 그룹·시간을 지정한 뒤 각 탭에서 VPN 게이트웨이 또는 ExpressRoute 회선을 선택합니다.

작업 영역 ID 형식:

```text
/subscriptions/<구독-ID>/resourceGroups/<리소스-그룹>/providers/Microsoft.OperationalInsights/workspaces/<작업-영역>
```

GUID 형식의 Workspace/Customer ID가 아니라 위 **Azure 리소스 ID**를 입력합니다. 다른 구독의 작업 영역도 해당 구독을 조회 범위에 포함하고 접근 권한이 있으면 선택할 수 있습니다. 한 번에 한 작업 영역을 조회합니다.

같은 리소스 그룹·같은 표시 이름으로 재배포하면 기존 Workbook을 업데이트합니다. 별도 사본이 필요하면 표시 이름이나 `workbookId`를 바꾸세요. 개인 편집 내용을 유지해야 한다면 재배포 전에 사본을 저장하세요.

## 화면 구성

| 탭 | 주요 내용 | 데이터 원본 |
|---|---|---|
| 통합 현황 | 리소스 수, 배포 상태, VPN/ExpressRoute 연결 구성, 리소스 목록 | Resource Graph |
| VPN 게이트웨이 | S2S 터널 대역폭·수신/송신·드롭, BGP 상태/경로, P2S 연결/대역폭, 최근 진단 | Metrics + 선택형 로그 |
| VNet 피어링 | 방향별 연결·주소 공간 동기화·전달 트래픽·게이트웨이 전송, 실제 통신 테스트 결과 | Resource Graph + 선택형 Connection Monitor 로그 |
| ExpressRoute 회선 | 공급자 프로비저닝, 회선/피어링 설정, 피어별 BGP/ARP 가용성, 기본/보조 트래픽, 게이트웨이 CPU/처리량 | Resource Graph + Metrics + 선택형 로그 |
| 진단·변경 로그 | 수집 여부, 범주별 추이, 최근 이벤트, 네트워크 리소스 활동 로그 | Log Analytics |
| 설정·해석 안내 | 권한, 수집 설정, 단위, 제약, 데이터 부재 해석 | 한국어 안내 |

화면 제목·설명·필터·표 열·지표 별칭은 한국어입니다. Azure Portal 자체 메뉴, 공급자가 반환하는 상태 문자열·차원 값·로그 메시지, API 식별자는 원문 그대로 표시될 수 있습니다.

## 사전 준비

### 권한

- 배포: 대상 리소스 그룹의 `Microsoft.Insights/workbooks/write` 권한(예: Workbook Contributor 또는 Contributor). `Microsoft.Insights` 리소스 공급자가 등록되어 있어야 합니다.
- 구성 조회: 대상 네트워크 리소스와 구독의 Reader 등 읽기 권한.
- 지표 조회: 대상 리소스의 Monitoring Reader 등 지표 읽기 권한.
- 로그 조회: 해당 작업 영역과 테이블의 로그 쿼리 권한(예: Log Analytics Reader). 테이블별 권한·접근 모드도 영향을 줍니다.
- 진단 설정·활동 로그 내보내기·Connection Monitor 구성: 각각의 별도 관리 권한. Workbook 배포 권한만으로 충족되지 않습니다.

배포 지역은 Workbook 저장 지역입니다. 모니터링 대상의 지역과 같을 필요는 없습니다. 다중 구독은 현재 로그인 컨텍스트에서 접근 가능한 구독을 대상으로 하며, 다른 테넌트의 리소스까지 자동으로 통합하지 않습니다.

### 지표: 별도 수집 설정 불필요

VPN/ExpressRoute 지표는 플랫폼 Metrics를 직접 조회합니다. `AzureMetrics`로 내보낼 필요가 없으며, 내보내기로 손실될 수 있는 터널·피어 차원을 유지합니다.

| 구분 | 주요 REST 지표 이름 | 단위 / 집계 |
|---|---|---|
| VPN 터널 | `TunnelAverageBandwidth` | 바이트/초, 평균 |
| VPN 트래픽 | `TunnelIngressBytes`, `TunnelEgressBytes` | 바이트, 구간 합계 |
| VPN 드롭 | `TunnelIngressPacketDropCount`, `TunnelEgressPacketDropCount` | 패킷, 구간 합계 |
| VPN BGP | `BgpPeerStatus` | 0/1, 평균 |
| VPN 경로 | `BgpRoutesLearned`, `BgpRoutesAdvertised` | 개수, 공급자 지원 구간 합계 |
| VPN P2S | `P2SConnectionCount`, `P2SBandwidth` | 연결 수 구간 합계 / 바이트/초 평균 |
| ExpressRoute 가용성 | `BgpAvailability`, `ArpAvailability` | %, 평균 |
| ExpressRoute 트래픽 | `BitsInPerSecond`, `BitsOutPerSecond` | 비트/초, 평균 |
| ExpressRoute VNet 게이트웨이 | `ExpressRouteGatewayCpuUtilization`, `ExpressRouteGatewayBitsPerSecond` | % / 비트/초, 평균 |

- BGP/ARP는 기본·보조 **Peer** 차원으로 분할합니다. Private와 비-Private(Microsoft 등)는 별도 그래프이며, 미구성 피어링 그래프는 비어 있을 수 있습니다.
- 트래픽은 **DeviceRole**로 분할하므로 기본·보조 링크가 합쳐져 이중 계산되는 것을 피합니다.
- VPN 터널은 ConnectionName으로, BGP는 BgpPeerAddress로 분할합니다. 선택 차원에 포함되지 않는 인스턴스·RemoteIP는 집계되므로 개별 연결 내 전체 세션 분석은 Metrics 탐색기에서 추가 분할하세요.
- 경로·P2S 연결 합계는 순간값이나 고유 연결 개수가 아닙니다. 집계 시간 구간을 고려하세요.
- VPN BGP 평균이 0과 1 사이이면 구간 중 변화 또는 미분할 인스턴스 간 상태 차이일 수 있습니다. 평균 1만으로 이중화 전체의 상태를 보장하지 않습니다.
- SKU·BGP/P2S/터널 구성에 따라 일부 지표가 없을 수 있습니다. 결측값을 0 또는 정상으로 바꾸지 않습니다.
- ExpressRoute 회선과 게이트웨이는 독립 선택합니다. 연결 목록의 ID로 실제 연결 관계를 확인하세요.

### 로그: 기존 작업 영역으로 진단 전송

Azure Portal의 각 리소스 **모니터링 → 진단 설정**에서 필요한 범주를 같은 작업 영역으로 전송합니다. 지원 범주는 리소스/SKU에 따라 확인하세요.

| 대상 | 권장 범주 / 테이블 |
|---|---|
| VPN Gateway | `GatewayDiagnosticLog`, `TunnelDiagnosticLog`, `RouteDiagnosticLog`, `IKEDiagnosticLog`, `P2SDiagnosticLog` → `AzureDiagnostics` |
| ExpressRoute 회선 | `PeeringRouteLog` → `AzureDiagnostics` |
| 구독 활동 로그 | 구독의 활동 로그 → 진단 설정 → `Administrative` 등 → `AzureActivity` |
| Connection Monitor | Network Watcher에서 테스트/에이전트 및 출력 작업 영역 구성 → `NWConnectionMonitorTestResult` |

진단 로그는 이벤트가 발생해야 생성되며 전송에 시간이 걸립니다. **로그 없음은 정상 또는 변경 없음의 증거가 아닙니다.** 수집 확인 패널은 데이터가 없을 때 설정·권한·범위 점검을 안내합니다. 이벤트 수를 장애 건수로 계산하지 않습니다.

아직 테이블이 없는 작업 영역에서도 안내가 나오도록 빈 스키마와 `union isfuzzy=true`를 사용합니다. Azure가 누락 테이블 경고를 표시할 수 있으며, 권한 오류는 숨기지 않습니다. 쿼리는 Analytics 테이블 기준입니다.

### VNet Peering의 실제 통신 감시

VNet 피어링 자체의 전용 처리량·지연 지표를 만들어 내지 않습니다.

1. 양쪽 VNet에 테스트 원본/대상을 준비하고 Network Watcher Connection Monitor를 구성합니다.
2. 필요한 Network Watcher 에이전트를 설치하고 TCP/ICMP/HTTP 테스트와 출력 작업 영역을 구성합니다.
3. NSG·UDR·방화벽·이름 확인·대상 포트 및 테스트가 실제 피어링 경로를 통과하는지 점검합니다.
4. Workbook에서 같은 작업 영역을 선택하고 VNet Peering 탭을 엽니다.

테스트 표는 선택한 **Connection Monitor 리소스**의 구독·리소스 그룹으로 필터링되며 VNet/VM의 리소스 그룹과 다를 수 있습니다. 선택 범위의 모든 테스트를 표시하며 특정 피어링과 자동 연결하지 않습니다. 테스트 그룹·구성·모니터 ID를 함께 표시해 서로 다른 테스트를 합치지 않습니다.

실패율은 `sum(ChecksFailed) / sum(ChecksTotal)`입니다. 검사 수가 0이면 알 수 없음(null)으로 유지합니다. RTT는 유효 RTT가 있는 결과의 검사 수 가중 평균입니다. `Connected`는 구성 상태일 뿐 실제 통신·DNS·라우팅·SLA의 정상 보장이 아닙니다.

## 배포 및 수동 가져오기

Azure CLI로 배포할 수도 있습니다. 실행하면 실제 Workbook이 생성됩니다.

```powershell
az deployment group create `
  --resource-group <기존-리소스-그룹> `
  --template-file .\azuredeploy.json `
  --parameters workbookDisplayName="Azure 통합 네트워크 모니터"
```

수동 가져오기: Azure Monitor → 통합 문서 → 새로 만들기 → 편집 → 고급 편집기 → **Gallery Template** 형식에 [network-monitor.workbook](network-monitor.workbook)의 JSON을 붙여 넣고 저장합니다. [azuredeploy.json](azuredeploy.json)은 ARM 템플릿이므로 Workbook 고급 편집기에 붙여 넣는 파일이 아닙니다.

## 개발 및 검증

Node.js 22 이상이 필요하며 외부 npm 패키지는 필요하지 않습니다.

```powershell
npm run build
npm test
npm run check
```

- [scripts/build.mjs](scripts/build.mjs): 한국어 화면·필터·탭과 ARM 템플릿 생성.
- [scripts/queries.mjs](scripts/queries.mjs): ARG 및 Log Analytics 쿼리.
- [scripts/metrics.mjs](scripts/metrics.mjs): 지원 지표·차원·집계 정의.
- 생성된 두 JSON 파일을 직접 수정하지 말고 소스를 변경한 후 `npm run build`를 실행하세요.
- GitHub Actions는 생성 파일 일관성과 구조·범위·지표·탭·출처 테스트를 실행합니다. Azure 로그인을 사용하거나 리소스를 배포하지 않습니다.

Azure에 로그인되어 있다면 리소스를 생성하지 않고 ARM 공급자 검증과 실제 ARG/로그 쿼리 검증을 실행할 수 있습니다.

```powershell
.\scripts\validate-azure.ps1 `
  -ResourceGroup <기존-검증용-리소스-그룹> `
  -WorkspaceResourceId "/subscriptions/<구독>/resourceGroups/<그룹>/providers/Microsoft.OperationalInsights/workspaces/<작업영역>" `
  -RunFixtureTests
```

작업 영역을 생략하면 로그 검증은 생략됩니다. `-RunFixtureTests`는 실제 로그를 저장하지 않고 쿼리 안의 합성 데이터로 범위 필터·빈 데이터 경고·실패율/RTT 가중 계산·0개 검사 시 null 처리를 확인합니다. 현재 Azure CLI의 기본 구독을 사용합니다. 검증 결과는 행 수/성공 여부만 출력하며 실제 조회 내용이나 계정 정보를 저장소에 저장하지 않습니다. `az deployment group validate`를 사용하며 실제 배포 명령은 실행하지 않습니다.

**검증 범위:** 구조 검사나 ARM 공급자 검증 성공만으로 모든 실제 네트워크의 지표·로그가 존재하거나 Portal 렌더링이 검증되는 것은 아닙니다. 실제 VPN/ExpressRoute 리소스와 진단 전송을 설정한 뒤 각 그래프·필터·시간 변경을 확인하세요.

### 구현 시 검증 결과 (2026-11-02)

- 로컬 자동 테스트 13개 및 생성 JSON 일관성 검사 통과.
- Azure ARM `ProviderNoRbac` 공급자 검증 통과(실제 배포하지 않음).
- 실제 Azure Resource Graph 쿼리 12개 및 Log Analytics 쿼리 9개 실행 성공.
- 합성 로그 테스트 3개 통과: 리소스 그룹 필터/메시지 정규화, 데이터 부재 경고, 검사 수 가중 실패율·RTT 및 0개 검사 시 null.
- 복제한 원본 5개 파일의 내용이 고정 커밋의 Git blob 해시와 일치함을 확인.
- 검증 환경에 VPN Gateway/ExpressRoute 회선이 없어 해당 실제 시계열과 Azure Portal 화면은 검증하지 못했습니다. 테스트용 네트워크나 유료 회선을 임의 생성하지 않았습니다.

## 제한 및 문제 해결

| 증상 / 제한 | 확인 사항 |
|---|---|
| 리소스 없음 | 구독·리소스 그룹·로그인 테넌트·Reader 권한 및 실제 리소스 유형 확인 |
| 지표 없음 | 리소스 선택, 시간, SKU, 터널/피어링/BGP/P2S 구성, Monitoring Reader 권한 확인 |
| 로그 패널 미표시 | 상단 로그 작업 영역 선택. 작업 영역은 조회 구독 범위 안에 있어야 함 |
| 로그 없음 / 테이블 경고 | 진단 전송 대상, 범주, 활동 로그 내보내기, 시간 범위, 수집 지연, 테이블 권한 확인 |
| 피어링 한 방향만 표시 | 반대편 구독 선택·권한 및 해당 VNet의 실제 구성 확인 |
| 주소 공간 동기화 미보고 | 상태를 정상으로 간주하지 말고 해당 VNet의 피어링 상세 확인 |
| Connection Monitor 없음 | 에이전트·테스트·출력 작업 영역 및 모니터 리소스의 구독/그룹 범위 확인 |
| 대규모 리소스 | ARG 표 최대 1,000행, `mv-expand` 서비스 한도, 지표 분할 상위 20개. 필터를 좁히거나 Portal에서 개별 조회 |
| 시간 의미 | 구성은 현재 스냅샷(반영 지연 가능), 로그 시간 열은 UTC, 조회 시간 필터는 지표/로그에만 적용 |
| 경보 미수신 | 이 배포는 조회용 Workbook만 생성. 운영용 Azure Monitor 경고 규칙·작업 그룹은 별도 구성 |

지원 범위는 **VNet 기반 VPN Gateway / VNet 기반 ExpressRoute Gateway와 회선 / VNet Peering**입니다. Virtual WAN VPN/ExpressRoute Gateway, ErGwScale 전용 지표, ExpressRoute Direct 포트, Flow Logs, Azure Firewall 분석은 포함하지 않습니다. 원본 Firewall Workbook은 [upstream](upstream/)에서 별도로 보존합니다.

Workbook은 저장된 조회 화면이며 데이터 수집을 대신하지 않습니다. Log Analytics 수집/보존·쿼리, Connection Monitor·네트워크 테스트·기타 네트워크 리소스 비용은 별도로 발생할 수 있습니다. 새 테스트용 VM·회선 등은 자동 생성하지 않습니다.

## 공식 참고 자료

- [Azure Workbooks 데이터 원본](https://learn.microsoft.com/azure/azure-monitor/visualize/workbooks-data-sources)
- [VPN/ExpressRoute Gateway 지원 지표](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-virtualnetworkgateways-metrics)
- [ExpressRoute 회선 지원 지표](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-expressroutecircuits-metrics)
- [VPN Gateway 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-virtualnetworkgateways-logs)
- [ExpressRoute 회선 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-expressroutecircuits-logs)
- [VNet Peering 개요](https://learn.microsoft.com/azure/virtual-network/virtual-network-peering-overview)
- [Connection Monitor 개요](https://learn.microsoft.com/azure/network-watcher/connection-monitor-overview)
- [Connection Monitor 결과 테이블](https://learn.microsoft.com/azure/azure-monitor/reference/tables/nwconnectionmonitortestresult)

출처·저작권·변경 범위는 [NOTICE.md](NOTICE.md)를 참조하세요.
