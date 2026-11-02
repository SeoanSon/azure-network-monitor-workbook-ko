import { metrics, metricSources } from './metrics.mjs';

export const categories = [
  { value: 'performance', label: '성능', pillar: 'Performance Efficiency', reference: 'performance-efficiency', codes: 'PE:02 용량 계획 · PE:04 성능 측정', purpose: '필요한 처리량과 응답 속도를 충족하는지 확인합니다.', review: '피크 시간의 트래픽·RTT·CPU를 확인해 병목과 용량 부족을 찾습니다.' },
  { value: 'cost', label: '비용', pillar: 'Cost Optimization', reference: 'cost-optimization', codes: 'CO:06 사용량과 과금 단위 · CO:07 구성 요소 비용 최적화', purpose: '할당한 용량을 실제로 얼마나 사용하는지 확인합니다.', review: '업무 주기별 사용량을 회선 용량·SKU와 비교해 과다 할당 검토 대상을 찾습니다.' },
  { value: 'availability', label: '가용성', pillar: 'Reliability', reference: 'reliability', codes: 'RE:05 이중화 · RE:10 상태 모니터링', purpose: '필요한 경로가 연결되어 통신할 수 있는지 확인합니다.', review: '기본·보조 연결의 BGP/ARP 상태와 터널 드롭·테스트 실패를 확인합니다.' },
  { value: 'operations', label: '운영', pillar: 'Operational Excellence', reference: 'operational-excellence', codes: 'OE:07 관측 가능성 · OE:08 인시던트 대응', purpose: '구성 변경과 장애의 원인을 추적할 수 있는지 확인합니다.', review: '경로 수·피어링 설정의 변경 시점을 진단·활동 로그와 대조합니다.' },
];

const tunnelDimensions = ['ConnectionName', 'RemoteIP', 'Instance'];
const bgpDimensions = ['BgpPeerAddress', 'Instance'];
const circuitDimensions = ['PeeringType', 'DeviceRole'];
const vpnGrain = 'PT1M부터';
const gatewayGrain = 'PT5M부터';

export const metricCriteria = {
  vpnBandwidth: { categories: ['performance', 'cost'], meaning: '터널의 평균 대역폭입니다.', unit: 'BytesPerSecond (바이트/초)', aggregations: ['Average'], dimensions: tunnelDimensions, grain: vpnGrain, review: 'VPN 통신이 느려지거나 터널 용량 증설을 검토할 때 확인합니다.', costReview: '게이트웨이 SKU 대비 터널의 평상시·피크 사용 수준을 검토할 때 확인합니다.' },
  vpnIngress: { categories: ['performance', 'cost'], meaning: '터널이 수신한 데이터 바이트 수입니다.', unit: 'Bytes (바이트)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '수신 트래픽이 급증하거나 시간대별 부하가 달라질 때 확인합니다.', costReview: '수신 데이터량이 늘어난 터널과 시간대를 찾을 때 확인합니다.' },
  vpnEgress: { categories: ['performance', 'cost'], meaning: '터널이 송신한 데이터 바이트 수입니다.', unit: 'Bytes (바이트)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '송신 트래픽이 급증하거나 대량 전송의 영향을 확인할 때 봅니다.', costReview: '송신 데이터량 증가가 발생한 연결을 찾아 전송 패턴을 검토할 때 확인합니다.' },
  vpnIngressDrop: { categories: ['availability'], meaning: '터널에서 드롭된 수신 패킷 수입니다.', unit: 'Count (패킷 수)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '온프레미스에서 Azure 방향으로 통신 실패·재전송이 발생할 때 확인합니다.' },
  vpnEgressDrop: { categories: ['availability'], meaning: '터널에서 드롭된 송신 패킷 수입니다.', unit: 'Count (패킷 수)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: 'Azure에서 온프레미스 방향으로 통신 실패·재전송이 발생할 때 확인합니다.' },
  vpnBgp: { categories: ['availability'], meaning: 'VPN 게이트웨이의 BGP 피어 연결 상태입니다.', unit: 'Count (상태 값 0/1)', aggregations: ['Average'], dimensions: bgpDimensions, grain: vpnGrain, review: 'BGP 연결이 끊기거나 원격 네트워크 경로가 사라질 때 피어별로 확인합니다.' },
  vpnLearned: { categories: ['operations'], meaning: 'BGP 피어를 통해 학습한 경로 수입니다.', unit: 'Count (경로 수)', aggregations: ['Total'], dimensions: bgpDimensions, grain: vpnGrain, review: '온프레미스 경로 변경 후 Azure가 경로를 수신했는지 확인할 때 봅니다.' },
  vpnAdvertised: { categories: ['operations'], meaning: 'BGP 피어에 광고한 경로 수입니다.', unit: 'Count (경로 수)', aggregations: ['Total'], dimensions: bgpDimensions, grain: vpnGrain, review: 'Azure 주소 공간·라우팅 정책 변경 후 경로 광고 추이를 확인할 때 봅니다.' },
  vpnP2s: { categories: ['performance'], meaning: '게이트웨이의 Point-to-Site 연결 수입니다.', unit: 'Count (연결 수)', aggregations: ['Total'], dimensions: ['Protocol', 'Instance'], grain: vpnGrain, review: '원격 접속 수요가 늘거나 P2S 접속 부하를 분석할 때 프로토콜별로 확인합니다.' },
  vpnP2sBandwidth: { categories: ['performance', 'cost'], meaning: '게이트웨이의 Point-to-Site 대역폭입니다.', unit: 'BytesPerSecond (바이트/초)', aggregations: ['Average'], dimensions: ['Instance'], grain: vpnGrain, review: '원격 사용자의 전송 속도가 느려질 때 인스턴스별 P2S 부하를 확인합니다.', costReview: '원격 접속용 게이트웨이 용량이 실제 P2S 사용 수준에 맞는지 검토할 때 봅니다.' },
  erBgp: { categories: ['availability'], meaning: 'MSEE에서 모든 피어 방향으로 측정한 BGP 가용성입니다.', unit: 'Percent (%)', aggregations: ['Average'], dimensions: ['PeeringType', 'Peer'], grain: 'PT1M', review: 'ExpressRoute 경로가 끊기거나 기본·보조 BGP 연결 상태를 점검할 때 확인합니다.' },
  erArp: { categories: ['availability'], meaning: 'MSEE에서 모든 피어 방향으로 측정한 ARP 가용성입니다.', unit: 'Percent (%)', aggregations: ['Average'], dimensions: ['PeeringType', 'Peer'], grain: 'PT1M', review: 'BGP 연결 장애 시 기본·보조 피어의 ARP 연결 상태를 구분해 확인합니다.' },
  erIngress: { categories: ['performance', 'cost'], meaning: '초당 Azure로 들어오는 비트 수입니다.', unit: 'BitsPerSecond (비트/초)', aggregations: ['Total', 'Average', 'Minimum', 'Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: 'Azure 수신 속도가 느려지거나 기본·보조 링크 간 수신 부하를 비교할 때 봅니다.', costReview: '회선의 수신 트래픽이 적은 시간대와 링크를 찾아 할당 용량을 검토할 때 봅니다.' },
  erEgress: { categories: ['performance', 'cost'], meaning: '초당 Azure에서 나가는 비트 수입니다.', unit: 'BitsPerSecond (비트/초)', aggregations: ['Total', 'Average', 'Minimum', 'Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: 'Azure 송신 속도가 느려지거나 기본·보조 링크 간 송신 부하를 비교할 때 봅니다.', costReview: '회선의 송신 트래픽이 증가한 구간을 찾아 요금제와 전송 패턴을 검토할 때 봅니다.' },
  erIngressUtilization: { categories: ['performance', 'cost'], meaning: '수신 링크 대역폭의 백분율 사용률입니다.', unit: 'Percent (%)', aggregations: ['Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: '수신 지연이 발생하거나 피크 시간의 수신 링크 포화를 점검할 때 확인합니다.', costReview: '업무 피크에도 수신 용량이 남는지 확인해 회선 용량 조정을 검토할 때 봅니다.' },
  erEgressUtilization: { categories: ['performance', 'cost'], meaning: '송신 링크 대역폭의 백분율 사용률입니다.', unit: 'Percent (%)', aggregations: ['Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: '송신 지연이 발생하거나 피크 시간의 송신 링크 포화를 점검할 때 확인합니다.', costReview: '업무 피크에도 송신 용량이 남는지 확인해 회선 용량 조정을 검토할 때 봅니다.' },
  erGatewayCpu: { categories: ['performance', 'cost'], meaning: 'ExpressRoute VNet 게이트웨이의 CPU 사용률입니다.', unit: 'Percent (%)', aggregations: ['Average', 'Minimum', 'Maximum'], dimensions: ['roleInstance'], grain: gatewayGrain, review: '회선에 여유가 있는데도 통신이 느릴 때 게이트웨이 CPU 부하를 확인합니다.', costReview: '지속적으로 CPU 여유가 있는 게이트웨이의 SKU 적정성을 검토할 때 확인합니다.' },
  erGatewayBandwidth: { categories: ['performance', 'cost'], meaning: 'ExpressRoute VNet 게이트웨이가 초당 수신하는 비트 수입니다.', unit: 'BitsPerSecond (비트/초)', aggregations: ['Average', 'Minimum', 'Maximum'], dimensions: ['roleInstance'], grain: gatewayGrain, review: '게이트웨이 처리량이 병목인지 또는 인스턴스별 부하가 치우치는지 확인할 때 봅니다.', costReview: '게이트웨이를 통과하는 사용량과 할당 SKU의 용량을 비교할 때 확인합니다.' },
};

const aggregationNames = { 1: 'Total (합계)', 3: 'Maximum (최대)', 4: 'Average (평균)' };

export function metricCriteriaTable(category) {
  const rows = Object.entries(metricCriteria).filter(([, criterion]) => criterion.categories.includes(category)).map(([key, criterion]) => {
    const [namespace, , name, aggregation, splitBy] = metrics[key];
    const target = key.startsWith('vpn') ? 'VPN' : key.startsWith('erGateway') ? 'ER 게이트웨이' : 'ER 회선';
    const review = category === 'cost' ? criterion.costReview : criterion.review;
    return `| ${target}: [\`${name}\`](${metricSources[namespace]}) | ${criterion.unit}; 지원 집계: ${criterion.aggregations.join(', ')}; 차원: ${criterion.dimensions.join(', ')} | ${aggregationNames[aggregation]}; 분할: ${splitBy}; 최소 주기: ${criterion.grain} | ${criterion.meaning} ${review} |`;
  });
  return [
    '| 대상 / 공식 REST 지표 | 공식 단위·지원 집계·차원 | Workbook 적용 집계·분할 / 공식 최소 주기 | 점검기준 |',
    '|---|---|---|---|', ...rows,
  ].join('\n');
}

export const frameworkCriteria = `## Overview · 모니터링 기준
이 화면은 **무엇을 왜 모니터링하는지**를 먼저 설명합니다. 아래 REST 이름을 클릭하면 Microsoft Learn의 공식 지원 지표 문서가 열립니다. 공식 정의·단위·지원 집계·차원과, 이 Workbook에서 선택한 집계·분할·운영 해석을 구분했습니다.

### WAF 기준의 네 가지 조회 관점
[Azure Well-Architected Framework(WAF)](https://learn.microsoft.com/azure/well-architected/pillars)를 기준으로 **성능·비용·가용성·운영**을 분류했습니다. 가용성은 Reliability의 일부를 다루며 복구·DR 전체를 평가하지는 않습니다. WAF의 다섯 요소 중 Security는 이번 화면의 범위에 포함하지 않았습니다.
아래 체크리스트는 분류 근거이며, 개별 네트워크 메트릭에 적용한 점검기준은 이 Workbook의 운영 해석입니다.

| 조회 관점 | WAF 기준 | 모니터링 목적 | 점검기준 |
|---|---|---|---|
${categories.map(c => `| **${c.label}** | [${c.pillar} · ${c.codes}](https://learn.microsoft.com/azure/well-architected/${c.reference}/checklist) | ${c.purpose} | ${c.review} |`).join('\n')}

### 사용 순서
1. 여기서 공식 지표와 점검 기준을 확인합니다. 리소스 수·구성 목록은 **리소스 현황** 탭으로 이동했습니다.
2. 상단 **모니터링 관점**에서 하나를 선택한 뒤 VPN·VNet 피어링·ExpressRoute·진단 로그 탭을 엽니다. 기본 선택은 **성능**입니다.
3. 리소스 선택과 현재 구성 목록은 공통 맥락으로 유지되며, 상세 패널은 선택한 관점별로 바뀝니다. VPN의 S2S 로그 진단은 모든 관점에서 표시하며 P2S 성능은 선택형 보조 그룹에서 조회합니다. Overview의 기준 설명과 리소스 현황은 전체 기준을 항상 표시합니다.
4. 같은 지표가 성능과 비용 등 여러 관점에 재사용될 수 있습니다. 중복 조회는 별도의 지표나 비용 합산을 의미하지 않습니다.

### 공통 해석 안내
- 대상 리소스 유형/SKU에서 공식 지원되는 지표를 우선 사용하고, 차원을 유지할 수 있는 네이티브 Metrics를 조회합니다.
- **최소 주기는 공식 수집 주기이며 화면 집계 구간과 다릅니다.** Portal의 실제 구간은 조회 시간에 따라 달라질 수 있습니다.
- 아래 점검 기준은 공식 경보 임계값이 아닌 운영 해석입니다. **80%·95% 같은 임의의 공통 임계값을 Microsoft 권장값으로 제시하지 않습니다.** 업무 SLO·정상 기준선·피크·지속 시간·SKU 한도로 별도 정의해야 합니다.
- 문서의 모든 차원을 동시에 분할하지는 않습니다. 표의 적용 분할 외 차원은 집계되며 상위 20개 시계열만 표시합니다. 개별 터널/인스턴스 확인은 Metrics 탐색기에서 추가 분할하세요.
- 경로 수와 P2S 연결 수는 구간 합계입니다. 순간값·고유 개수와 구분해 동일 구간끼리 비교하세요. BGP 상태 평균은 시간·미분할 인스턴스에 따라 소수가 될 수 있습니다.
- 드롭은 패킷 개수이며 손실률이 아닙니다. BGP/ARP 가용성은 전체 서비스 SLA가 아닙니다.
- ExpressRoute 게이트웨이 지표는 기존 VNet 게이트웨이 대상입니다. ErGwScale 전용 지표는 미포함이며 FastPath 트래픽은 게이트웨이를 우회할 수 있습니다.
- 미수집·미지원·빈 데이터는 알 수 없음입니다. 0이나 정상으로 대체하지 않습니다. 구성의 Connected와 실제 통신 가용성은 다릅니다.`;

export const costCriteria = `### 비용 관점의 범위
이 Workbook의 비용 패널은 **용량·사용량 기반 최적화 참고**입니다. VPN 터널 바이트/대역폭, ExpressRoute 처리량·최대 대역폭 사용률·게이트웨이 CPU/처리량을 SKU·할당 회선 용량과 함께 봅니다.

**실제 청구 금액·단가·예산·절감액은 조회하거나 계산하지 않습니다.** [Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)의 비용 분석에서 리소스·미터·기간·계약을 확인하세요. 트래픽이 0이어도 할당 리소스의 고정 비용이 0이라는 뜻은 아닙니다. 요금제·방향·지역·이중화·성장 여유를 확인하기 전 축소/삭제를 권고하지 않습니다.

VNet 피어링은 이 Workbook에서 피어링별 전송 바이트를 수집하지 않습니다. 피어링 목록·개수나 Connection Monitor 결과로 트래픽 비용을 추정하지 않으며, 실제 비용은 Cost Management에서 별도 확인합니다.`;

export const nonMetricCriteria = `## 지표가 아닌 보완 관측 항목
아래는 플랫폼 Metrics가 아닌 **리소스 속성 또는 로그**입니다. 공식 메트릭으로 오인하지 않도록 별도로 분류합니다.

| 관점 | 대상·항목 | 원천 / 공식 문서 | 점검기준 |
|---|---|---|---|
| 성능 | 경로별 평균 RTT | [NWConnectionMonitorTestResult: AvgRoundTripTimeMs, ChecksTotal](https://learn.microsoft.com/azure/azure-monitor/reference/tables/nwconnectionmonitortestresult) | 테스트 경로의 왕복 지연입니다. VNet 간 응답이 느려질 때 평상시 RTT와 비교합니다. |
| 가용성 | 경로별 실패율 | [NWConnectionMonitorTestResult: ChecksFailed, ChecksTotal](https://learn.microsoft.com/azure/azure-monitor/reference/tables/nwconnectionmonitortestresult) | 전체 검사 중 실패한 비율입니다. 특정 경로의 통신이 끊기거나 간헐적으로 실패할 때 확인합니다. |
| 가용성·운영 | 피어링 연결·주소 공간 동기화·게이트웨이 전송 | [virtualNetworkPeerings 리소스 속성](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworks/virtualnetworkpeerings) / Resource Graph | 피어링 연결과 전송 설정입니다. VNet 연결이 끊기거나 주소 공간·허브 경유 설정을 변경한 뒤 확인합니다. |
| 운영 | VPN 터널·협상·경로·P2S 이벤트 | [VPN Gateway 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-virtualnetworkgateways-logs) / AzureDiagnostics | VPN 연결 과정의 이벤트입니다. 터널 재연결·인증 실패·경로 변경의 원인을 찾을 때 확인합니다. |
| 모든 관점 (VPN 공통) | S2S 연결·해제 및 DPD/IKE 진단 | [VPN 진단 로그 문제 해결](https://learn.microsoft.com/en-us/troubleshoot/azure/vpn-gateway/troubleshoot-vpn-with-azure-diagnostics) / TunnelDiagnosticLog, IKEDiagnosticLog, GatewayDiagnosticLog | S2S 터널 연결·해제와 DPD/IKE 관련 이벤트입니다. 터널이 반복해서 끊길 때 피어·인스턴스별 원문을 확인합니다. |
| 운영 | ExpressRoute 피어링 경로 이벤트 | [ExpressRoute 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-expressroutecircuits-logs) / PeeringRouteLog | ExpressRoute 피어링의 경로 이벤트입니다. 경로가 변경되거나 예상 경로가 보이지 않을 때 확인합니다. |
| 운영 | 네트워크 변경 이력 및 수집 여부 | [AzureActivity](https://learn.microsoft.com/azure/azure-monitor/reference/tables/azureactivity), 진단/Connection Monitor 수집 확인 | 리소스 작업 이력과 데이터 수집 상태입니다. 장애 전후의 변경 주체·시점 또는 로그 누락을 조사할 때 확인합니다. |
| 비용 | 할당 SKU·회선 대역폭·피어링 목록 | Resource Graph 구성 + [Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management) | 현재 할당한 네트워크 구성입니다. 사용량 대비 과도한 SKU·회선 용량을 검토할 때 함께 확인합니다. |

### 보완 관측 항목의 공통 해석
- RTT는 유효 결과의 검사 수 가중 평균이며, 실패율은 sum(ChecksFailed)/sum(ChecksTotal) × 100입니다. 전체 검사 0이면 null로 표시합니다.
- Connection Monitor 결과는 실제 테스트 경로 기준이며 특정 피어링과 자동 매칭하지 않습니다. Connected 구성만으로 실제 통신 성공을 보장하지 않습니다.
- 이벤트 건수는 장애 건수가 아니며, 로그가 없다고 정상 또는 변경 없음으로 판단하지 않습니다.
- DPD 표시는 문자열 기반 분류입니다. 원인 확정·현재 터널 상태·중단 시간·가동률을 뜻하지 않으며, 상세 해석은 VPN 탭의 S2S 진단 안내에서 확인합니다.

기준 문서 확인일: 2026-11-02. 지표 지원 여부는 실제 리소스의 SKU·설정 및 최신 공식 문서를 우선합니다.`;

export const vpnS2sGuidance = `## S2S 터널 연결·해제 및 DPD 진단
이 그룹은 **모니터링 관점 선택과 무관하게** VPN 탭에 표시됩니다. 위에서 **VPN 게이트웨이**, 수집 대상 **로그 작업 영역**, **시간 범위**를 선택하세요. 구독·리소스 그룹 필터는 작업 영역이 아니라 로그의 게이트웨이 리소스 ID에 적용됩니다.

### 수집 전제 및 해석 한계
- 게이트웨이의 진단 설정에서 \`TunnelDiagnosticLog\`, \`IKEDiagnosticLog\`, 필요 시 \`GatewayDiagnosticLog\`를 기존 Log Analytics 작업 영역으로 보내야 합니다. 이 배포는 **진단 설정을 만들거나 변경하지 않습니다**.
- 정책 기반(PolicyBased) 게이트웨이는 \`GatewayDiagnosticLog\`, \`RouteDiagnosticLog\`만 지원합니다. 터널/IKE 범주가 지원되지 않는 경우를 장애 없음으로 해석하지 마세요.
- 설정 전 로그는 소급 수집되지 않습니다. 수집 지연·보존 기간·권한·지원 범주·잘못 선택한 작업 영역도 확인하세요. 아직 테이블이 없으면 기존 쿼리와 동일하게 빈 스키마와 \`union isfuzzy=true\`를 사용하며 누락 테이블 경고가 표시될 수 있습니다. 권한 오류는 숨기지 않습니다.
- **빈 차트/0건은 정상·연결 중·장애 없음의 증거가 아닙니다.** 범주별 수집 현황은 선택 시간 안에 관측한 로그만 보여 주며, 진단 설정 활성 여부를 증명하지 않습니다.
- 연결·해제 차트는 상태가 아니라 **이벤트 수**입니다. 재연결·중복 이벤트와 창 시작 전 상태를 알 수 없으므로 가동률·중단 시간·현재 연결 상태를 계산하지 않습니다.
- DPD 전용 구조화 필드를 가정하지 않습니다. IKE \`Message\`의 시간 초과·실패 문자열을 휴리스틱으로 분류합니다. 정상 DPD 요청/응답, 설정·주기 및 부정 표현은 실패 집계에서 제외하며, **확정된 근본 원인**은 아닙니다. 기타 IKE 시간 초과·실패는 DPD 미확인으로 별도 표시합니다. 원문과 상대 장비 로그를 대조하세요. 피어 필드가 없으면 원문에서 직접 확인하세요.
- 추이/요약은 선택 기간 전체, 상세 표는 최근 1,000건(UTC 오름차순 표시)입니다. 데이터가 많으면 기간을 좁히세요. GatewayDiagnosticLog 원문은 구성 변경·HostMaintenanceEvent와의 시간 비교용이며 인과관계를 증명하지 않습니다.

[공식 VPN 진단 로그 안내](https://learn.microsoft.com/en-us/troubleshoot/azure/vpn-gateway/troubleshoot-vpn-with-azure-diagnostics)`;
