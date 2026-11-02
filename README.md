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
6. **Overview · 모니터링 기준**에서 공식 메트릭 설명을 확인하고, **모니터링 관점(성능·비용·가용성·운영)**을 선택한 뒤 각 탭에서 VPN 게이트웨이 또는 ExpressRoute 회선을 선택합니다. 기본 관점은 성능입니다.

작업 영역 ID 형식:

```text
/subscriptions/<구독-ID>/resourceGroups/<리소스-그룹>/providers/Microsoft.OperationalInsights/workspaces/<작업-영역>
```

GUID 형식의 Workspace/Customer ID가 아니라 위 **Azure 리소스 ID**를 입력합니다. 다른 구독의 작업 영역도 해당 구독을 조회 범위에 포함하고 접근 권한이 있으면 선택할 수 있습니다. 한 번에 한 작업 영역을 조회합니다.

같은 리소스 그룹·같은 표시 이름으로 재배포하면 기존 Workbook을 업데이트합니다. 별도 사본이 필요하면 표시 이름이나 `workbookId`를 바꾸세요. 개인 편집 내용을 유지해야 한다면 재배포 전에 사본을 저장하세요.

## 화면 구성

| 탭 | 주요 내용 | 데이터 원본 |
|---|---|---|
| Overview · 모니터링 기준 | 관점별 선정 목적, 공식 지표의 의미·단위·지원 집계·차원·최소 주기, 적용 집계·분할, 점검 기준·공식 문서 링크 | 한국어 기준 설명 (실시간 데이터 아님) |
| 리소스 현황 | 기존 통합 현황의 리소스 수, 배포 상태, VPN/ExpressRoute 연결 구성, 리소스 목록 | Resource Graph |
| VPN 게이트웨이 | S2S 터널 지표, 모든 관점에서 연결·해제 및 DPD/IKE 로그 진단, 선택형 P2S 성능, BGP 상태/경로, 기존 최근 진단 | Metrics + 선택형 로그 |
| VNet 피어링 | 방향별 연결·주소 공간 동기화·전달 트래픽·게이트웨이 전송, 실제 통신 테스트 결과 | Resource Graph + 선택형 Connection Monitor 로그 |
| ExpressRoute 회선 | 공급자 프로비저닝, 회선/피어링 설정, 피어별 BGP/ARP 가용성, 기본/보조 트래픽, 게이트웨이 CPU/처리량 | Resource Graph + Metrics + 선택형 로그 |
| 진단·변경 로그 | 수집 여부, 범주별 추이, 최근 이벤트, 네트워크 리소스 활동 로그 | Log Analytics |
| 설정·해석 안내 | 권한, 수집 설정, 단위, 제약, 데이터 부재 해석 | 한국어 안내 |

화면 제목·설명·필터·표 열·지표 별칭은 한국어입니다. Azure Portal 자체 메뉴, 공급자가 반환하는 상태 문자열·차원 값·로그 메시지, API 식별자는 원문 그대로 표시될 수 있습니다.

## WAF 모니터링 기준

[Azure Well-Architected Framework(WAF)](https://learn.microsoft.com/azure/well-architected/pillars)를 기준으로 성능·비용·가용성·운영을 분류합니다. 가용성은 Reliability의 일부이며 복구·DR 전체를 평가하지는 않습니다. Security는 이번 화면의 범위에 포함하지 않았습니다.

| 관점 | 공식 WAF 체크리스트 근거 | 확인할 질문 |
|---|---|---|
| 성능 | [PE:02 용량 계획 · PE:04 성능 측정](https://learn.microsoft.com/azure/well-architected/performance-efficiency/checklist) | 필요한 처리량과 응답 속도를 충족하는가? |
| 비용 | [CO:06 사용량과 과금 단위 · CO:07 구성 요소 비용 최적화](https://learn.microsoft.com/azure/well-architected/cost-optimization/checklist) | 할당 용량을 실제 사용 수준에 맞게 조정할 여지가 있는가? |
| 가용성 | [RE:05 이중화 · RE:10 상태 모니터링](https://learn.microsoft.com/azure/well-architected/reliability/checklist) | 기본·보조 경로가 연결되어 통신할 수 있는가? |
| 운영 | [OE:07 관측 가능성 · OE:08 인시던트 대응](https://learn.microsoft.com/azure/well-architected/operational-excellence/checklist) | 구성 변경과 장애의 원인을 추적할 수 있는가? |

WAF는 관점의 분류 근거이며, 이 Workbook의 개별 메트릭 선택이나 임계값을 직접 규정하는 목록은 아닙니다.

상단 **모니터링 관점**을 바꾸면 VPN·VNet 피어링·ExpressRoute·진단 로그의 상세 패널이 해당 관점으로 전환됩니다. 한 번에 하나를 선택하며 기본은 **성능**입니다. 리소스 선택·공통 구성 표는 맥락으로 유지됩니다. Overview의 기준 설명과 리소스 현황은 관점 선택과 무관하게 전체를 표시합니다. **VPN의 S2S 로그 진단도 모든 관점에 공통 표시**됩니다. 기존 지표는 삭제하지 않았으며 관점별로 재배치했습니다. 기존 진단·변경 로그 탭과 VPN 최근 이벤트 100건 표는 **운영**에서 그대로 확인하세요.

| 관점 | WAF 대응 | VPN | VNet Peering | ExpressRoute |
|---|---|---|---|---|
| **성능** | Performance Efficiency | 터널 평균 대역폭·수신/송신량, 명시적으로 펼치는 P2S 보조 지표 | Connection Monitor RTT·테스트 결과 | 평균 처리량, **최대 대역폭 사용률**, 게이트웨이 CPU·처리량 |
| **비용** | Cost Optimization | 터널/P2S 사용 패턴과 SKU 대조 | 구성 목록은 참고만 제공. 피어링별 전송량·청구액 미조회 | 회선 사용률·처리량·게이트웨이 부하와 할당 용량/SKU 대조 |
| **가용성** | Reliability | BGP 피어 상태, 방향별 터널 드롭 | 방향별 구성 상태 및 실제 테스트 실패율 | 기본·보조 피어별 BGP/ARP 가용성 |
| **운영** | Operational Excellence | BGP 학습/광고 경로, 터널·협상·P2S 진단 | 주소 공간 동기화·전송 설정, 측정 수집 여부 | 공급자/피어링 구성, PeeringRouteLog |

운영 관점의 진단·변경 로그 탭에서는 공통 네트워크 진단 이벤트·수집 여부·활동 로그를 조회합니다. 같은 지표가 성능과 비용 등 여러 관점에 재사용되어도 별도 지표나 비용 합산이 아닙니다.

### Overview에서 제공하는 공식 메트릭 설명

- 각 REST 지표 이름을 클릭하면 Microsoft Learn의 해당 리소스 **공식 지원 지표 문서**가 열립니다.
- 공식 의미·단위·지원 집계·차원·최소 수집 주기와 Workbook에서 실제로 적용한 집계·분할을 구분합니다.
- **최소 수집 주기와 화면 집계 구간은 다릅니다.** 실제 구간은 Portal의 조회 시간에 따라 달라질 수 있습니다.
- 공식 메트릭과 구분하여 Resource Graph 구성 속성·Connection Monitor 로그·진단/활동 로그의 역할도 설명합니다.
- **점검기준**은 “어떤 메트릭인지 + 언제 확인하는지”로 간결하게 표시합니다. 같은 지표라도 성능에서는 병목·부하, 비용에서는 사용 수준·할당 용량을 확인하도록 설명을 구분합니다.
- 예: `TunnelAverageBandwidth` → “터널의 평균 대역폭입니다. VPN 통신이 느려지거나 터널 용량 증설을 검토할 때 확인합니다.”
- 집계·SKU·비용 등의 주의사항은 개별 행 대신 공통 해석 안내와 비용 안내에서 설명합니다.
- 점검 기준은 공식 경보 임계값이 아닌 운영 해석입니다. 고정 80%·95% 등을 Microsoft 공통 권장 임계값으로 제시하지 않습니다. 업무 SLO·정상 기준선·피크·지속 시간·SKU 한도로 별도 정의해야 합니다.

### 비용 관점의 한계

비용 패널은 **용량·사용량 기반 최적화 참고**이며 실제 청구 금액·단가·예산·절감액을 조회하거나 계산하지 않습니다. 트래픽이 0이어도 할당 리소스의 고정 비용이 0이라는 뜻은 아닙니다.

실제 비용은 [Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)의 비용 분석에서 리소스·미터·기간·계약을 확인하세요. 요금제·과금 방향·지역·피크·장애 시 우회 트래픽·성장 여유를 고려해야 하므로 낮은 사용률만으로 축소/삭제를 권고하지 않습니다. 특히 피어링별 전송 바이트를 수집하지 않으므로 피어링 개수나 Connection Monitor 결과로 비용을 추정하지 않습니다.

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
| ExpressRoute 대역폭 사용률 | `IngressBandwidthUtilization`, `EgressBandwidthUtilization` | %, **최대** (공식 지원 집계) |
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

### VPN: S2S 로그 진단 및 선택형 P2S 성능

- VPN 탭은 기본 **성능**을 포함한 네 관점 모두에서 S2S 로그 진단을 제공합니다. 기존 S2S Metrics의 정의·집계·분할은 바꾸지 않았습니다.
- P2S 성능 차트 두 개는 `NotebookGroup/1.0`의 `loadType: explicit` 보조 그룹으로 이동했습니다. **P2S 보조 지표 펼치기**를 눌러야 조회합니다. 비용 관점의 기존 P2S 대역폭 지표는 유지합니다.
- **VPN 게이트웨이와 로그 작업 영역**을 선택해야 새 로그 패널을 조회합니다. 작업 영역은 중앙 수집 저장소이며, 구독·리소스 그룹·게이트웨이 필터는 **로그의 게이트웨이 리소스 ID**에 적용합니다. 작업 영역이 위치한 리소스 그룹으로 로그를 제한하지 않습니다. 시간 필터는 공통 조회 시간을 따릅니다.
- 게이트웨이 진단 설정에서 `TunnelDiagnosticLog`, `IKEDiagnosticLog`, 필요 시 `GatewayDiagnosticLog`를 선택한 기존 작업 영역으로 보내세요. **자동 수집 설정이나 과거 로그 소급 수집은 없습니다.** PolicyBased 게이트웨이는 `GatewayDiagnosticLog`, `RouteDiagnosticLog`만 지원합니다.

새 패널 8개:

1. 범주별 관측 건수와 최초/최종 UTC, 터널/IKE 미관측 경고.
2. `TunnelConnected` / `TunnelDisconnected` 이벤트 추이 (공통 시간 구간, 피어·인스턴스별).
3. 피어·인스턴스별 연결/해제 이벤트 요약 (현재 상태 아님).
4. 터널 연결·해제 시간순 원문.
5. DPD 시간 초과/실패 의심과 기타 IKE 시간 초과/실패를 구분한 추이.
6. 해당 의심 이벤트의 분류와 원문.
7. 정상 DPD 송수신까지 포함한 IKE 원문.
8. 구성 변경·`HostMaintenanceEvent` 등 GatewayDiagnosticLog 원문 (시간 비교용).

추이·요약은 선택 기간 전체를 집계하며 상세 표는 **최근 1,000건을 선택한 뒤 UTC 오름차순**으로 표시합니다. 피어 필드가 없는 IKE 로그는 `(원문에서 피어 확인)`으로 안내합니다.

DPD 분류는 구조화된 DPD 상태가 아니라 IKE `Message`의 **문자열 휴리스틱**입니다. 정상 요청/응답, 설정·주기 및 `No DPD timeout observed` 같은 부정 표현을 제외합니다. 기타 IKE 실패는 DPD 미확인으로 별도 표시합니다. 표현 차이로 누락·오분류가 가능하므로 원문 및 상대 장비 로그와 대조해야 하며 **확정된 근본 원인이 아닙니다**.

**빈 차트/0건은 정상·연결 중·장애 없음의 증거가 아닙니다.** 범주별 관측 건수는 진단 설정 활성 여부나 수집 완전성을 증명하지 않습니다. 미지원 범주·설정·작업 영역·권한·수집 지연·보존 기간을 확인하세요. 이벤트 창으로 현재 상태·중단 시간·가동률을 계산하지 않으며 Gateway 이벤트의 시간상 인접도 인과관계가 아닙니다.

[공식 VPN 진단 로그 문제 해결](https://learn.microsoft.com/en-us/troubleshoot/azure/vpn-gateway/troubleshoot-vpn-with-azure-diagnostics)

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
- [scripts/criteria.mjs](scripts/criteria.mjs): WAF 관점 분류, 지표별 공식 정의·지원 집계·차원·점검기준과 Overview 설명.
- 생성된 두 JSON 파일을 직접 수정하지 말고 소스를 변경한 후 `npm run build`를 실행하세요. 지표를 추가할 때 공식 정의와 관점 분류도 추가해야 하며 테스트로 누락을 검출합니다.
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

검증 스크립트는 실제 Workbook 구독 선택기와 동일한 `/subscriptions/<GUID>`를 기본 쿼리 입력으로 사용합니다. 피어링 조회는 기존 GUID 입력으로도 실행해 두 형식의 결과 ID가 동일한지 비교합니다. Resource Graph API의 요청 범위 `subscriptions` 배열에는 별도로 GUID를 사용합니다. API 요청 범위와 Workbook 매개변수 값을 혼동하지 않아야 합니다.

### 최초 구현 검증 결과 (2026-11-02)

- 로컬 자동 테스트 13개 및 생성 JSON 일관성 검사 통과.
- Azure ARM `ProviderNoRbac` 공급자 검증 통과(실제 배포하지 않음).
- 실제 Azure Resource Graph 쿼리 12개 및 Log Analytics 쿼리 9개 실행 성공.
- 합성 로그 테스트 3개 통과: 리소스 그룹 필터/메시지 정규화, 데이터 부재 경고, 검사 수 가중 실패율·RTT 및 0개 검사 시 null.
- 복제한 원본 5개 파일의 내용이 고정 커밋의 Git blob 해시와 일치함을 확인.
- 검증 환경에 VPN Gateway/ExpressRoute 회선이 없어 해당 실제 시계열과 Azure Portal 화면은 검증하지 못했습니다. 테스트용 네트워크나 유료 회선을 임의 생성하지 않았습니다.

### Overview·관점별 분류 업데이트

공식 지표 18개의 설명과 실제 화면 항목 대응, 4개 관점 × 4개 상세 탭의 가시성, 관점 간 잘못된 지표 노출 방지, 선택 리소스/작업 영역 조건 유지, 최대 사용률 집계, 비용 미조회 안내를 포함한 **자동 테스트 22개와 ARM 공급자 검증**을 통과했습니다. ARM에서 정적 JSON 옵션을 식으로 오인하지 않도록 이스케이프 처리도 검증합니다. 추가 지표는 ExpressRoute 회선의 수신/송신 대역폭 사용률이며 공식 문서에서 지원하는 **Maximum**을 적용합니다. 로그/ARG 쿼리의 범위와 의미는 유지합니다.

기존 배포본은 GitHub 변경만으로 자동 갱신되지 않습니다. 위 **Deploy to Azure**로 같은 리소스 그룹·Workbook 표시 이름을 사용해 재배포하거나, 고급 편집기에서 갱신된 Gallery Template을 가져오세요. 재배포 전 개인 편집 내용을 사본으로 저장하세요.

### 피어링 미표시 수정: 구독 선택값 형식

초기 템플릿은 쿼리의 GUID 형식 `subscriptionId`를 구독 선택값과 직접 비교했습니다. 그러나 Workbook 구독 선택기는 `/subscriptions/<GUID>` 리소스 ID 형식을 반환하므로, 실제 피어링이 있어도 비교가 일치하지 않아 결과가 0건이 될 수 있었습니다. CLI에서 GUID만 대입한 초기 실행 검증은 이 문제를 검출하지 못했습니다.

수정본은 **구독 리소스 ID를 기본값**으로 설정하고, 리소스 그룹 선택·리소스 목록·피어링·게이트웨이 선택·로그 필터 전반에서 리소스 ID와 기존 GUID 값을 모두 처리합니다. VNet 피어링 **구성 목록은 VPN Gateway나 Log Analytics 작업 영역 없이도** 표시됩니다. RTT·실패율 측정만 별도의 Connection Monitor와 로그 설정이 필요합니다.

이 수정은 자동 테스트 24개, ARM 공급자 검증, 실제 ARG/로그 쿼리 및 합성 로그 검증을 통과했습니다. 피어링이 존재하는 검증 환경에서 두 구독 값 형식의 결과 ID가 실제 ARM 피어링 ID와 일치함을 확인했고, 로컬 VNet의 리소스 그룹을 선택하면 표시되며 피어링이 없는 Workbook 저장 그룹만 선택하면 제외되는 것도 검증했습니다. Azure Portal의 실제 렌더링 검증과는 구분됩니다.

## 제한 및 문제 해결

| 증상 / 제한 | 확인 사항 |
|---|---|
| 리소스 없음 | 구독·리소스 그룹·로그인 테넌트·Reader 권한 및 실제 리소스 유형 확인 |
| 지표 없음 | 리소스 선택, 시간, SKU, 터널/피어링/BGP/P2S 구성, Monitoring Reader 권한 확인 |
| 로그 패널 미표시 | 상단 로그 작업 영역 선택. 작업 영역은 조회 구독 범위 안에 있어야 함 |
| 로그 없음 / 테이블 경고 | 진단 전송 대상, 범주, 활동 로그 내보내기, 시간 범위, 수집 지연, 테이블 권한 확인 |
| 피어링 한 방향만 표시 | 반대편 구독 선택·권한 및 해당 VNet의 실제 구성 확인 |
| VNet 피어링이 있는데 구성 목록 전체가 비어 있음 | 구독 ID 형식 필터를 수정한 최신 템플릿으로 재배포. 조회 구독과 **로컬 VNet이 속한** 리소스 그룹을 선택. Workbook 저장 리소스 그룹만 선택하면 다른 그룹의 피어링은 제외됨 |
| 주소 공간 동기화 미보고 | 상태를 정상으로 간주하지 말고 해당 VNet의 피어링 상세 확인 |
| Connection Monitor 없음 | 에이전트·테스트·출력 작업 영역 및 모니터 리소스의 구독/그룹 범위 확인 |
| 대규모 리소스 | ARG 표 최대 1,000행, `mv-expand` 서비스 한도, 지표 분할 상위 20개. 필터를 좁히거나 Portal에서 개별 조회 |
| 시간 의미 | 구성은 현재 스냅샷(반영 지연 가능), 로그 시간 열은 UTC, 조회 시간 필터는 지표/로그에만 적용 |
| 경보 미수신 | 이 배포는 조회용 Workbook만 생성. 운영용 Azure Monitor 경고 규칙·작업 그룹은 별도 구성 |

지원 범위는 **VNet 기반 VPN Gateway / VNet 기반 ExpressRoute Gateway와 회선 / VNet Peering**입니다. Virtual WAN VPN/ExpressRoute Gateway, ErGwScale 전용 지표, ExpressRoute Direct 포트, Flow Logs, Azure Firewall 분석은 포함하지 않습니다. 원본 Firewall Workbook은 [upstream](upstream/)에서 별도로 보존합니다.

Workbook은 저장된 조회 화면이며 데이터 수집을 대신하지 않습니다. Log Analytics 수집/보존·쿼리, Connection Monitor·네트워크 테스트·기타 네트워크 리소스 비용은 별도로 발생할 수 있습니다. 새 테스트용 VM·회선 등은 자동 생성하지 않습니다.

## 공식 참고 자료

- [WAF의 공식 5가지 핵심 요소](https://learn.microsoft.com/azure/well-architected/pillars)
- [실제 청구 비용 확인: Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)
- [Azure Workbooks 데이터 원본](https://learn.microsoft.com/azure/azure-monitor/visualize/workbooks-data-sources)
- [VPN/ExpressRoute Gateway 지원 지표](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-virtualnetworkgateways-metrics)
- [ExpressRoute 회선 지원 지표](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-expressroutecircuits-metrics)
- [VPN Gateway 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-virtualnetworkgateways-logs)
- [ExpressRoute 회선 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-expressroutecircuits-logs)
- [VNet Peering 개요](https://learn.microsoft.com/azure/virtual-network/virtual-network-peering-overview)
- [Connection Monitor 개요](https://learn.microsoft.com/azure/network-watcher/connection-monitor-overview)
- [Connection Monitor 결과 테이블](https://learn.microsoft.com/azure/azure-monitor/reference/tables/nwconnectionmonitortestresult)

출처·저작권·변경 범위는 [NOTICE.md](NOTICE.md)를 참조하세요.
