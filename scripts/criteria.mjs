import { metrics, metricSources } from './metrics.mjs';

export const categories = [
  { value: 'performance', label: '성능', pillar: 'Performance Efficiency', purpose: '처리량·지연·CPU·용량 병목을 파악합니다.', review: '업무 피크와 평상시 기준선을 비교하고, SKU/회선 한도와 함께 점검합니다. 단일 평균만으로 증설하지 않습니다.' },
  { value: 'cost', label: '비용', pillar: 'Cost Optimization', purpose: '실제 사용량과 할당 용량을 비교해 최적화 검토 대상을 찾습니다.', review: '업무 주기·피크·성장·이중화 요구와 실제 청구를 함께 봅니다. 트래픽·사용률은 비용 참고 지표이며 청구 금액이나 절감액이 아닙니다.' },
  { value: 'availability', label: '가용성', pillar: 'Reliability', purpose: 'BGP/ARP·터널 드롭·경로별 통신 실패·피어링 구성을 확인합니다.', review: '기본/보조 경로를 각각 확인하고 실제 통신 결과와 대조합니다. 플랫폼 가용성 지표를 전체 서비스 SLA로 바꾸지 않습니다.' },
  { value: 'operations', label: '운영', pillar: 'Operational Excellence', purpose: '경로·피어링 설정·변경 이력·진단 데이터 수집을 확인합니다.', review: '변경 전후와 승인된 구성 기준을 비교하고 원인을 추적합니다. 배포 성공이나 로그 존재만으로 정상 판정하지 않습니다.' },
];

const tunnelDimensions = ['ConnectionName', 'RemoteIP', 'Instance'];
const bgpDimensions = ['BgpPeerAddress', 'Instance'];
const circuitDimensions = ['PeeringType', 'DeviceRole'];
const vpnGrain = 'PT1M부터';
const gatewayGrain = 'PT5M부터';

export const metricCriteria = {
  vpnBandwidth: { categories: ['performance', 'cost'], meaning: '터널의 평균 대역폭입니다.', unit: 'BytesPerSecond (바이트/초)', aggregations: ['Average'], dimensions: tunnelDimensions, grain: vpnGrain, review: '연결별 지속적인 증가·피크를 비교합니다. SKU 처리량은 구성에 따라 달라지며 이 값을 청구 트래픽으로 간주하지 않습니다.' },
  vpnIngress: { categories: ['performance', 'cost'], meaning: '터널이 수신한 데이터 바이트 수입니다.', unit: 'Bytes (바이트)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '시간 구간별 수신량 증가를 점검합니다. 구간 합계를 보며 바이트/초와 혼동하지 않습니다. 방향별 과금 여부는 계약·가격표로 확인합니다.' },
  vpnEgress: { categories: ['performance', 'cost'], meaning: '터널이 송신한 데이터 바이트 수입니다.', unit: 'Bytes (바이트)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '시간 구간별 송신량과 사용 패턴을 검토합니다. 내보낸 데이터량이 실제 청구 바이트와 같다고 가정하지 않습니다.' },
  vpnIngressDrop: { categories: ['availability'], meaning: '터널에서 드롭된 수신 패킷 수입니다.', unit: 'Count (패킷 수)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '드롭 발생·증가 시 트래픽·협상·라우팅 진단을 함께 확인합니다. 개수만으로 패킷 손실률이나 장애 건수를 계산하지 않습니다.' },
  vpnEgressDrop: { categories: ['availability'], meaning: '터널에서 드롭된 송신 패킷 수입니다.', unit: 'Count (패킷 수)', aggregations: ['Total'], dimensions: tunnelDimensions, grain: vpnGrain, review: '수신/송신 방향을 구분해 발생 구간을 조사합니다. 드롭 0만으로 실제 통신 성공을 보장하지 않습니다.' },
  vpnBgp: { categories: ['availability'], meaning: 'VPN 게이트웨이의 BGP 피어 연결 상태입니다.', unit: 'Count (상태 값 0/1)', aggregations: ['Average'], dimensions: bgpDimensions, grain: vpnGrain, review: '연결 해제 또는 기준선 변화 시 피어·인스턴스를 확인합니다. 평균의 소수 값은 시간 변화 또는 미분할 인스턴스 차이일 수 있습니다.' },
  vpnLearned: { categories: ['operations'], meaning: 'BGP 피어를 통해 학습한 경로 수입니다.', unit: 'Count (경로 수)', aggregations: ['Total'], dimensions: bgpDimensions, grain: vpnGrain, review: '동일 집계 구간에서 변경 전후를 비교합니다. 문서 지원 합계 집계이므로 현재 라우팅 테이블의 고유 경로 수로 해석하지 않습니다.' },
  vpnAdvertised: { categories: ['operations'], meaning: 'BGP 피어에 광고한 경로 수입니다.', unit: 'Count (경로 수)', aggregations: ['Total'], dimensions: bgpDimensions, grain: vpnGrain, review: '예상된 경로 광고 정책과 변경 이력을 대조합니다. 갑작스러운 변화는 점검 신호이며 자동 장애 판정이 아닙니다.' },
  vpnP2s: { categories: ['performance'], meaning: '게이트웨이의 Point-to-Site 연결 수입니다.', unit: 'Count (연결 수)', aggregations: ['Total'], dimensions: ['Protocol', 'Instance'], grain: vpnGrain, review: '프로토콜별 추이와 SKU의 P2S 한도를 함께 검토합니다. 구간 합계는 순간 동시 접속자나 고유 사용자 수가 아닙니다.' },
  vpnP2sBandwidth: { categories: ['performance', 'cost'], meaning: '게이트웨이의 Point-to-Site 대역폭입니다.', unit: 'BytesPerSecond (바이트/초)', aggregations: ['Average'], dimensions: ['Instance'], grain: vpnGrain, review: '인스턴스별 추이로 P2S 부하를 확인합니다. 저사용만으로 게이트웨이를 축소하거나 삭제하지 않습니다.' },
  erBgp: { categories: ['availability'], meaning: 'MSEE에서 모든 피어 방향으로 측정한 BGP 가용성입니다.', unit: 'Percent (%)', aggregations: ['Average'], dimensions: ['PeeringType', 'Peer'], grain: 'PT1M', review: 'Private/비-Private와 기본/보조 Peer를 분리해 저하를 점검합니다. 이 값은 애플리케이션 가용성이나 월간 SLA가 아닙니다.' },
  erArp: { categories: ['availability'], meaning: 'MSEE에서 모든 피어 방향으로 측정한 ARP 가용성입니다.', unit: 'Percent (%)', aggregations: ['Average'], dimensions: ['PeeringType', 'Peer'], grain: 'PT1M', review: 'BGP 가용성과 함께 기본/보조 연결 상태를 확인합니다. 특정 경로의 저하가 평균에 가려지지 않도록 분할해 봅니다.' },
  erIngress: { categories: ['performance', 'cost'], meaning: '초당 Azure로 들어오는 비트 수입니다.', unit: 'BitsPerSecond (비트/초)', aggregations: ['Total', 'Average', 'Minimum', 'Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: '피어링 유형과 장치 역할별 처리량을 비교합니다. Workbook은 평균을 사용하며 전송량·과금액을 계산하지 않습니다.' },
  erEgress: { categories: ['performance', 'cost'], meaning: '초당 Azure에서 나가는 비트 수입니다.', unit: 'BitsPerSecond (비트/초)', aggregations: ['Total', 'Average', 'Minimum', 'Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: '평균 송신 처리량과 사용 패턴을 확인합니다. VPN의 바이트/초와 8배 단위 차이가 있으며 요금제에 따른 실제 비용은 별도 확인합니다.' },
  erIngressUtilization: { categories: ['performance', 'cost'], meaning: '수신 링크 대역폭의 백분율 사용률입니다.', unit: 'Percent (%)', aggregations: ['Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: '문서 지원 최대 집계로 피크 포화를 확인합니다. 반복적인 여유는 용량 검토의 근거일 뿐 축소 권고나 절감액 계산이 아닙니다.' },
  erEgressUtilization: { categories: ['performance', 'cost'], meaning: '송신 링크 대역폭의 백분율 사용률입니다.', unit: 'Percent (%)', aggregations: ['Maximum'], dimensions: circuitDimensions, grain: 'PT1M', review: '피크 구간의 최대 사용률을 기본/보조 장치별로 봅니다. 장애 시 우회 트래픽과 성장 여유를 함께 고려합니다.' },
  erGatewayCpu: { categories: ['performance', 'cost'], meaning: 'ExpressRoute VNet 게이트웨이의 CPU 사용률입니다.', unit: 'Percent (%)', aggregations: ['Average', 'Minimum', 'Maximum'], dimensions: ['roleInstance'], grain: gatewayGrain, review: '인스턴스별 평균 추이로 지속 부하를 점검합니다. CPU 평균만으로 SKU 축소를 결정하지 않습니다. 기존 VNet 게이트웨이 대상이며 ErGwScale 전용 지표는 미포함입니다.' },
  erGatewayBandwidth: { categories: ['performance', 'cost'], meaning: 'ExpressRoute VNet 게이트웨이가 초당 수신하는 비트 수입니다.', unit: 'BitsPerSecond (비트/초)', aggregations: ['Average', 'Minimum', 'Maximum'], dimensions: ['roleInstance'], grain: gatewayGrain, review: '게이트웨이 인스턴스별 평균 처리량과 SKU를 대조합니다. FastPath 경로는 게이트웨이를 우회할 수 있으므로 회선 전체 트래픽이나 청구량과 같지 않습니다.' },
};

const aggregationNames = { 1: 'Total (합계)', 3: 'Maximum (최대)', 4: 'Average (평균)' };

export function metricCriteriaTable(category) {
  const rows = Object.entries(metricCriteria).filter(([, criterion]) => criterion.categories.includes(category)).map(([key, criterion]) => {
    const [namespace, , name, aggregation, splitBy] = metrics[key];
    const target = key.startsWith('vpn') ? 'VPN' : key.startsWith('erGateway') ? 'ER 게이트웨이' : 'ER 회선';
    return `| ${target}: [\`${name}\`](${metricSources[namespace]}) | ${criterion.meaning} | ${criterion.unit}; 지원 집계: ${criterion.aggregations.join(', ')}; 차원: ${criterion.dimensions.join(', ')} | ${aggregationNames[aggregation]}; 분할: ${splitBy}; 최소 주기: ${criterion.grain} | ${criterion.review} |`;
  });
  return [
    '| 대상 / 공식 REST 지표 | 공식 문서 기준 의미 | 공식 단위·지원 집계·차원 | Workbook 적용 집계·분할 / 공식 최소 주기 | 선정 이유 및 점검 기준 (운영 해석) |',
    '|---|---|---|---|---|', ...rows,
  ].join('\n');
}

export const frameworkCriteria = `## Overview · 모니터링 기준
이 화면은 **무엇을 왜 모니터링하는지**를 먼저 설명합니다. 아래 REST 이름을 클릭하면 Microsoft Learn의 공식 지원 지표 문서가 열립니다. 공식 정의·단위·지원 집계·차원과, 이 Workbook에서 선택한 집계·분할·운영 해석을 구분했습니다.

### CAF 운영 원칙과 네 가지 조회 관점
[CAF 모니터링 지침](https://learn.microsoft.com/azure/cloud-adoption-framework/manage/monitor)을 운영 기준으로 삼고, 요청한 **성능·비용·가용성·운영**을 [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/pillars)의 Performance Efficiency·Cost Optimization·Reliability·Operational Excellence에 대응시켰습니다.
**CAF의 공식 네 가지 축을 그대로 인용한 분류는 아닙니다.** WAF에는 Security도 있으며 이번 네 가지 조회 관점에서 제외한 것이지 보안이 불필요하다는 의미가 아닙니다.

| 조회 관점 | WAF 대응 | 모니터링 목적 | 판단 기준 |
|---|---|---|---|
${categories.map(c => `| **${c.label}** | ${c.pillar} | ${c.purpose} | ${c.review} |`).join('\n')}

### 사용 순서
1. 여기서 공식 지표와 점검 기준을 확인합니다. 리소스 수·구성 목록은 **리소스 현황** 탭으로 이동했습니다.
2. 상단 **모니터링 관점**에서 하나를 선택한 뒤 VPN·VNet 피어링·ExpressRoute·진단 로그 탭을 엽니다. 기본 선택은 **성능**입니다.
3. 리소스 선택과 현재 구성 목록은 공통 맥락으로 유지되며, 상세 패널은 선택한 관점별로 바뀝니다. Overview의 기준 설명과 리소스 현황은 전체 기준을 항상 표시합니다.
4. 같은 지표가 성능과 비용 등 여러 관점에 재사용될 수 있습니다. 중복 조회는 별도의 지표나 비용 합산을 의미하지 않습니다.

### 공통 선정·판정 원칙
- 대상 리소스 유형/SKU에서 공식 지원되는 지표를 우선 사용하고, 차원을 유지할 수 있는 네이티브 Metrics를 조회합니다.
- **최소 주기는 공식 수집 주기이며 화면 집계 구간과 다릅니다.** Portal의 실제 구간은 조회 시간에 따라 달라질 수 있습니다.
- 아래 점검 기준은 공식 경보 임계값이 아닌 운영 해석입니다. **80%·95% 같은 임의의 공통 임계값을 Microsoft 권장값으로 제시하지 않습니다.** 업무 SLO·정상 기준선·피크·지속 시간·SKU 한도로 별도 정의해야 합니다.
- 문서의 모든 차원을 동시에 분할하지는 않습니다. 표의 적용 분할 외 차원은 집계되며 상위 20개 시계열만 표시합니다. 개별 터널/인스턴스 확인은 Metrics 탐색기에서 추가 분할하세요.
- 미수집·미지원·빈 데이터는 알 수 없음입니다. 0이나 정상으로 대체하지 않습니다. 구성의 Connected와 실제 통신 가용성은 다릅니다.`;

export const costCriteria = `### 비용 관점의 범위
이 Workbook의 비용 패널은 **용량·사용량 기반 최적화 참고**입니다. VPN 터널 바이트/대역폭, ExpressRoute 처리량·최대 대역폭 사용률·게이트웨이 CPU/처리량을 SKU·할당 회선 용량과 함께 봅니다.

**실제 청구 금액·단가·예산·절감액은 조회하거나 계산하지 않습니다.** [Microsoft Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management)의 비용 분석에서 리소스·미터·기간·계약을 확인하세요. 트래픽이 0이어도 할당 리소스의 고정 비용이 0이라는 뜻은 아닙니다. 요금제·방향·지역·이중화·성장 여유를 확인하기 전 축소/삭제를 권고하지 않습니다.

VNet 피어링은 이 Workbook에서 피어링별 전송 바이트를 수집하지 않습니다. 피어링 목록·개수나 Connection Monitor 결과로 트래픽 비용을 추정하지 않으며, 실제 비용은 Cost Management에서 별도 확인합니다.`;

export const nonMetricCriteria = `## 지표가 아닌 보완 관측 항목
아래는 플랫폼 Metrics가 아닌 **리소스 속성 또는 로그**입니다. 공식 메트릭으로 오인하지 않도록 별도로 분류합니다.

| 관점 | 대상·항목 | 원천 / 공식 문서 | 선정 이유 및 판정 한계 |
|---|---|---|---|
| 성능 | 경로별 평균 RTT | [NWConnectionMonitorTestResult: AvgRoundTripTimeMs, ChecksTotal](https://learn.microsoft.com/azure/azure-monitor/reference/tables/nwconnectionmonitortestresult) | 유효 RTT가 있는 결과의 검사 수 가중 평균. 특정 피어링 경로와 자동 매칭하지 않으며 애플리케이션 처리 시간은 아님 |
| 가용성 | 경로별 실패율 | [NWConnectionMonitorTestResult: ChecksFailed, ChecksTotal](https://learn.microsoft.com/azure/azure-monitor/reference/tables/nwconnectionmonitortestresult) | sum(ChecksFailed)/sum(ChecksTotal) × 100. 전체 검사 0이면 null. 실제 테스트 경로의 결과이며 전체 서비스 SLA가 아님 |
| 가용성·운영 | 피어링 연결·주소 공간 동기화·게이트웨이 전송 | [virtualNetworkPeerings 리소스 속성](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworks/virtualnetworkpeerings) / Resource Graph | 현재 제어 평면 설정을 확인. Connected는 NSG·UDR·방화벽·DNS·데이터 평면 성공을 보장하지 않음 |
| 운영 | VPN 터널·협상·경로·P2S 이벤트 | [VPN Gateway 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-virtualnetworkgateways-logs) / AzureDiagnostics | 상태 변화의 원인과 변경 시점을 조사. 이벤트 건수는 장애 건수가 아님 |
| 운영 | ExpressRoute 피어링 경로 이벤트 | [ExpressRoute 지원 로그](https://learn.microsoft.com/azure/azure-monitor/reference/supported-logs/microsoft-network-expressroutecircuits-logs) / PeeringRouteLog | 경로 변경을 추적. 회선·피어링 설정과 함께 확인 |
| 운영 | 네트워크 변경 이력 및 수집 여부 | [AzureActivity](https://learn.microsoft.com/azure/azure-monitor/reference/tables/azureactivity), 진단/Connection Monitor 수집 확인 | 누가 무엇을 변경했는지와 관측 가능 여부를 확인. 로그가 없다고 변경 없음 또는 정상으로 판단하지 않음 |
| 비용 | 할당 SKU·회선 대역폭·피어링 목록 | Resource Graph 구성 + [Cost Management](https://learn.microsoft.com/azure/cost-management-billing/costs/overview-cost-management) | 구성은 사용 지표를 해석하는 맥락. 실제 비용·피어링 전송량은 이 Workbook에서 미조회 |

기준 문서 확인일: 2026-11-02. 지표 지원 여부는 실제 리소스의 SKU·설정 및 최신 공식 문서를 우선합니다.`;
