import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import * as q from './queries.mjs';
import { metrics } from './metrics.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repository = 'SeoanSon/azure-network-monitor-workbook-ko';
export const templateUrl = `https://raw.githubusercontent.com/${repository}/main/azuredeploy.json`;
export const deployUrl = `https://portal.azure.com/#create/Microsoft.Template/uri/${encodeURIComponent(templateUrl)}`;

const visibility = (parameterName, value) => ({ parameterName, comparison: 'isEqualTo', value });
const text = (name, json) => ({ type: 1, name, content: { json } });
const parameters = (name, values) => ({
  type: 9, name,
  content: { version: 'KqlParameterItem/1.0', parameters: values, style: 'pills', queryType: 1, resourceType: 'microsoft.resourcegraph/resources' },
});
const parameter = (name, label, type, extra = {}) => ({
  id: name, version: 'KqlParameterItem/1.0', name, label, type, ...extra,
});
const resourceParameter = (name, label, type, filter = '') => parameter(name, label, 5, {
  isRequired: true, multiSelect: false,
  query: `Resources\n| where type =~ '${type}'\n${q.scope}${filter}\n| project id, name\n| order by name asc`,
  queryType: 1, resourceType: 'microsoft.resourcegraph/resources',
  crossComponentResources: ['{Subscriptions}'],
  value: null, typeSettings: { additionalResourceOptions: [], showDefault: false },
});
const graph = (name, title, query, visualization = 'table') => ({
  type: 3, name,
  content: {
    version: 'KqlItem/1.0', title, query, size: 0, queryType: 1,
    resourceType: 'microsoft.resourcegraph/resources', crossComponentResources: ['{Subscriptions}'],
    visualization, gridSettings: { filter: true, rowLimit: 1000 },
  },
});
const logs = (name, title, query, visualization = 'table') => ({
  type: 3, name,
  conditionalVisibility: { parameterName: 'Workspace', comparison: 'isNotEqualTo', value: '' },
  content: {
    version: 'KqlItem/1.0', title, query, size: 0, queryType: 0,
    resourceType: 'microsoft.operationalinsights/workspaces', crossComponentResources: ['{Workspace}'],
    timeContextFromParameter: 'TimeRange', visualization,
    gridSettings: { filter: true, rowLimit: 1000 },
  },
});
const metric = (name, title, resourceParameterName, keys, extra = {}) => ({
  type: 10, name,
  conditionalVisibility: { parameterName: resourceParameterName, comparison: 'isNotEqualTo', value: '' },
  content: {
    version: 'MetricsItem/2.0', chartId: name, size: 0, chartType: 2,
    resourceType: metrics[keys[0]][0], metricScope: 0,
    resourceParameter: resourceParameterName, resourceIds: [`{${resourceParameterName}}`],
    timeContextFromParameter: 'TimeRange', timeContext: { durationMs: 86400000 },
    metrics: keys.map(key => {
      const [namespace, category, metricName, aggregation, splitBy, columnName] = metrics[key];
      return { namespace, metric: `${namespace}-${category}-${metricName}`, aggregation, splitBy, columnName, splitByLimit: 20 };
    }),
    title, ...extra,
  },
});
const group = (name, tab, items) => ({
  type: 12, name, conditionalVisibility: visibility('Tab', tab),
  content: { version: 'NotebookGroup/1.0', groupType: 'editable', items },
});

export function createWorkbook() {
  return {
    version: 'Notebook/1.0', isLocked: true, fallbackResourceIds: ['Azure Monitor'],
    items: [
      text('title', '# Azure 통합 네트워크 모니터\nVPN Gateway · VNet Peering · ExpressRoute\n\n구성 정보(Resource Graph), 시계열 지표(Azure Monitor), 진단 로그(Log Analytics)를 한곳에서 조회합니다. **배포 성공·로그 없음·Connected 구성 상태를 실제 통신 정상으로 해석하지 마세요.**'),
      parameters('global-filters', [
        parameter('Subscriptions', '조회 구독', 6, {
          isRequired: true, multiSelect: true, quote: "'", delimiter: ',',
          value: ['value::selected'], typeSettings: { additionalResourceOptions: [] },
        }),
        parameter('ResourceGroups', '리소스 그룹', 2, {
          isRequired: true, multiSelect: true, quote: "'", delimiter: ',',
          query: 'ResourceContainers\n| where type =~ \'microsoft.resources/subscriptions/resourcegroups\'\n| where subscriptionId in~ ({Subscriptions})\n| project value = name, label = name\n| distinct value, label\n| order by label asc',
          queryType: 1, resourceType: 'microsoft.resourcegraph/resources',
          crossComponentResources: ['{Subscriptions}'], value: ['value::all'],
          typeSettings: { additionalResourceOptions: ['value::all'], selectAllValue: '*' },
        }),
        parameter('TimeRange', '조회 시간', 4, {
          isRequired: true, value: { durationMs: 86400000 },
          typeSettings: {
            selectableValues: [3600000, 14400000, 86400000, 604800000, 2592000000].map(durationMs => ({ durationMs })),
            allowCustom: true,
          },
        }),
        parameter('Workspace', '로그 작업 영역 (선택)', 5, {
          isRequired: false, multiSelect: false, value: '',
          query: "Resources\n| where type =~ 'microsoft.operationalinsights/workspaces'\n| project id, name\n| order by name asc",
          queryType: 1, resourceType: 'microsoft.resourcegraph/resources',
          crossComponentResources: ['{Subscriptions}'],
          typeSettings: { additionalResourceOptions: [], showDefault: false },
        }),
        parameter('Tab', '화면', 1, { value: 'overview', isHiddenWhenLocked: true }),
      ]),
      {
        type: 11, name: 'navigation',
        content: {
          version: 'LinkItem/1.0', style: 'tabs',
          links: [
            ['overview', '통합 현황'], ['vpn', 'VPN 게이트웨이'], ['peering', 'VNet 피어링'],
            ['expressroute', 'ExpressRoute 회선'], ['logs', '진단·변경 로그'], ['guide', '설정·해석 안내'],
          ].map(([subTarget, linkLabel]) => ({ id: `tab-${subTarget}`, cellValue: 'Tab', linkTarget: 'parameter', linkLabel, subTarget, style: 'link' })),
        },
      },
      group('overview-section', 'overview', [
        text('overview-note', '## 통합 현황\n구독과 리소스 그룹 필터는 구성 목록·지표 대상 선택·로그 조회에 적용됩니다. **조회 시간은 지표와 로그에만 적용**되며, Resource Graph 표는 현재 구성의 지연 반영된 스냅샷입니다. 표가 비어 있으면 권한·필터·해당 유형의 리소스 존재 여부를 확인하세요.'),
        graph('summary', '종류별 리소스 수와 배포 상태', q.summary),
        graph('inventory', '네트워크 리소스 목록', q.inventory),
        graph('connections', 'VPN / ExpressRoute 연결 구성 상태', q.connections),
      ]),
      group('vpn-section', 'vpn', [
        text('vpn-note', '## VPN Gateway\n목록에서 게이트웨이를 선택하면 해당 리소스의 지표를 직접 조회합니다. 별도의 지표 내보내기는 필요하지 않습니다. **터널 평균 대역폭 단위는 바이트/초**입니다.\n\nBGP 상태는 0(연결 해제)/1(연결)이며 평균 집계 중 소수 값은 구간 내 변화 가능성을 뜻합니다. 터널 연결·BGP 사용·P2S 구성 및 SKU에 따라 지표가 없을 수 있습니다. 경로 수와 P2S 연결 수는 공급자가 지원하는 **구간 합계**이며 순간값이나 고유 연결 수가 아닙니다. 드롭은 전체 패킷 수 대비 비율이 아닌 개수입니다.'),
        parameters('vpn-selector', [resourceParameter('VpnGateway', 'VPN 게이트웨이', 'microsoft.network/virtualnetworkgateways', "\n| where properties.gatewayType =~ 'Vpn'")]),
        graph('vpn-inventory', 'VPN 게이트웨이 구성', q.vpnInventory),
        metric('vpn-bandwidth', '연결별 터널 평균 대역폭 (바이트/초)', 'VpnGateway', ['vpnBandwidth']),
        metric('vpn-traffic', '연결별 터널 수신·송신량 (바이트/구간)', 'VpnGateway', ['vpnIngress', 'vpnEgress']),
        metric('vpn-drops', '연결별 터널 수신·송신 드롭 (패킷/구간)', 'VpnGateway', ['vpnIngressDrop', 'vpnEgressDrop']),
        metric('vpn-bgp', 'BGP 피어 상태 (0/1, 평균)', 'VpnGateway', ['vpnBgp']),
        metric('vpn-routes', 'BGP 피어별 학습·광고 경로 (합계/구간)', 'VpnGateway', ['vpnLearned', 'vpnAdvertised']),
        metric('vpn-p2s', '프로토콜별 P2S 연결 (합계/구간)', 'VpnGateway', ['vpnP2s']),
        metric('vpn-p2s-bandwidth', '인스턴스별 P2S 평균 대역폭 (바이트/초)', 'VpnGateway', ['vpnP2sBandwidth']),
        text('vpn-log-note', '### 선택 게이트웨이의 최근 진단 로그\n로그 작업 영역을 선택하고 게이트웨이의 진단 설정을 먼저 구성하세요. 메시지에 협상·재연결·라우팅 변경이 포함될 수 있습니다. 이벤트 수를 장애 건수로 해석하지 마세요.'),
        logs('vpn-logs', '선택 VPN 게이트웨이의 최근 이벤트 100건', q.selectedVpnLogs),
      ]),
      group('peering-section', 'peering', [
        text('peering-note', '## VNet Peering\n각 행은 로컬 VNet에서 원격 VNet으로 향하는 **한 방향의 피어링**입니다. 양쪽 VNet에 대한 조회 권한이 있으면 반대 방향도 별도 행으로 표시됩니다. 원격이 다른 구독·테넌트에 있고 권한이 없으면 반대편은 확인할 수 없습니다.\n\n**Connected는 제어 평면 상태이며 NSG·UDR·방화벽·DNS·VM 통신의 성공을 보장하지 않습니다.** 피어링 자체의 전용 처리량·지연 지표를 가정하지 않습니다. 아래 Connection Monitor 결과는 선택 범위의 모니터 전체이며 특정 피어링과 자동으로 매칭하지 않습니다. 해당 경로를 측정하는 테스트를 구성해야 합니다.'),
        graph('peerings', '방향별 연결·주소 공간 동기화·게이트웨이 전송 설정', q.peerings),
        text('connectivity-note', '### 실제 통신 측정 (선택)\nNetwork Watcher Connection Monitor를 구성하고 **같은 로그 작업 영역**으로 전송해야 합니다. 구독·리소스 그룹 필터는 테스트 대상 VM이 아니라 **Connection Monitor 리소스**에 적용됩니다. RTT는 검사 수 가중 평균이며 측정 지연·실패율은 해당 테스트 경로 기준입니다.'),
        logs('connectivity-coverage', 'Connection Monitor 측정 데이터 확인', q.connectivityCoverage),
        logs('connectivity', '테스트별 실패율·평균 RTT', q.connectivity),
      ]),
      group('expressroute-section', 'expressroute', [
        text('expressroute-note', '## ExpressRoute\n회선과 ExpressRoute 가상 네트워크 게이트웨이를 각각 선택하세요. **회선과 게이트웨이는 자동 연결되지 않으므로** 연결 구성 표의 회선 ID와 게이트웨이 ID를 대조하세요.\n\nBGP/ARP 가용성은 공급자가 보고하는 백분율 그대로 표시합니다(0~100). 기본·보조 피어를 분리하고 Private/비-Private 피어링을 나눠 봅니다. 비-Private에는 Microsoft 피어링 등이 포함됩니다. 해당 유형이 없으면 그래프가 비어 있습니다. 트래픽은 **비트/초**이며 VPN의 바이트/초와 다릅니다. 회선 프로비저닝 성공은 실제 BGP/데이터 경로의 정상 여부를 의미하지 않습니다.'),
        parameters('expressroute-selectors', [
          resourceParameter('Circuit', 'ExpressRoute 회선', 'microsoft.network/expressroutecircuits'),
          resourceParameter('ErGateway', 'ExpressRoute 게이트웨이', 'microsoft.network/virtualnetworkgateways', "\n| where properties.gatewayType =~ 'ExpressRoute'"),
        ]),
        graph('circuit-inventory', 'ExpressRoute 회선·공급자 프로비저닝 상태', q.circuitInventory),
        graph('circuit-peerings', '선택 회선의 피어링 설정', q.circuitPeerings),
        metric('er-private-bgp', 'Private 피어별 BGP 가용성 (%)', 'Circuit', ['erBgp'], { filters: [{ id: 'private-bgp', key: 'PeeringType', operator: 0, values: ['private'] }] }),
        metric('er-private-arp', 'Private 피어별 ARP 가용성 (%)', 'Circuit', ['erArp'], { filters: [{ id: 'private-arp', key: 'PeeringType', operator: 0, values: ['private'] }] }),
        metric('er-other-bgp', '비-Private (Microsoft 등) 피어별 BGP 가용성 (%)', 'Circuit', ['erBgp'], { filters: [{ id: 'other-bgp', key: 'PeeringType', operator: 1, values: ['private'] }] }),
        metric('er-other-arp', '비-Private (Microsoft 등) 피어별 ARP 가용성 (%)', 'Circuit', ['erArp'], { filters: [{ id: 'other-arp', key: 'PeeringType', operator: 1, values: ['private'] }] }),
        metric('er-private-traffic', 'Private 기본·보조 장치별 수신·송신 (비트/초)', 'Circuit', ['erIngress', 'erEgress'], { filters: [{ id: 'private-traffic', key: 'PeeringType', operator: 0, values: ['private'] }] }),
        metric('er-other-traffic', '비-Private 기본·보조 장치별 수신·송신 (비트/초)', 'Circuit', ['erIngress', 'erEgress'], { filters: [{ id: 'other-traffic', key: 'PeeringType', operator: 1, values: ['private'] }] }),
        text('er-gateway-note', '### ExpressRoute 게이트웨이 지표\n아래 지표는 기존 VNet 게이트웨이 SKU 대상입니다. ErGwScale·Virtual WAN 게이트웨이에는 적용하지 않습니다. 해당 SKU에서는 지표가 없을 수 있습니다.'),
        metric('er-gateway-cpu', '게이트웨이 인스턴스별 CPU (%)', 'ErGateway', ['erGatewayCpu']),
        metric('er-gateway-throughput', '게이트웨이 인스턴스별 수신 (비트/초)', 'ErGateway', ['erGatewayBandwidth']),
        logs('er-route-logs', '선택 회선의 최근 피어링 경로 로그 100건', q.selectedCircuitLogs),
      ]),
      group('logs-section', 'logs', [
        text('logs-note', '## 진단·변경 로그\n상단에서 로그 작업 영역을 선택하세요. 미선택 시 로그 패널은 숨겨집니다. 진단 설정과 구독 활동 로그 내보내기는 자동 생성하지 않습니다.\n\n아직 생성되지 않은 테이블은 `union isfuzzy=true`로 조회하며 Azure의 경고가 표시될 수 있습니다. **데이터 없음은 정상 또는 이벤트 없음 판정이 아닙니다.** 권한 오류는 그대로 표시됩니다. 이벤트 수는 오류 수가 아닙니다. 표의 시간은 UTC입니다.'),
        logs('diagnostics-coverage', '네트워크 진단 로그 수집 확인', q.diagnosticsCoverage),
        logs('diagnostics-timeline', '범주별 진단 이벤트 추이', q.diagnosticsTimeline, 'timechart'),
        logs('diagnostics-recent', '최근 네트워크 진단 이벤트 250건', q.diagnosticsRecent),
        logs('activity-coverage', '활동 로그 수집 확인', q.activityCoverage),
        logs('activity-recent', '생성·변경·삭제 등을 포함한 최근 네트워크 활동 250건', q.activityRecent),
      ]),
      group('guide-section', 'guide', [
        text('setup-guide', `## 시작하기
1. **조회 구독·리소스 그룹**을 지정하고 VPN/ExpressRoute 화면에서 리소스를 선택합니다.
2. 구성 목록은 Reader, 지표는 Monitoring Reader 등 필요한 조회 권한이 있어야 합니다.
3. 로그가 필요하면 Log Analytics 작업 영역을 선택하고 해당 작업 영역의 로그 조회 권한을 준비합니다.
4. VPN Gateway 진단 설정: GatewayDiagnosticLog, TunnelDiagnosticLog, RouteDiagnosticLog, IKEDiagnosticLog, P2SDiagnosticLog 중 지원되는 범주를 작업 영역으로 보냅니다.
5. ExpressRoute 회선: PeeringRouteLog를 작업 영역으로 보냅니다. 지원 범주는 리소스의 진단 설정에서 확인합니다.
6. 구독의 활동 로그 진단 설정에서 Administrative 등을 같은 작업 영역으로 보냅니다.
7. 피어링을 통한 실제 통신은 Connection Monitor 테스트·에이전트·출력 작업 영역을 구성합니다.

## 해석과 제한
- ARM 배포는 **공유 Workbook 하나만 생성**합니다. 네트워크·로그 설정·경고 규칙·에이전트는 만들거나 변경하지 않습니다.
- 리소스 구성은 현재 스냅샷이며 지연 반영됩니다. 시점별 구성 이력·SLA 보고서가 아닙니다.
- 다중 구독은 같은 로그인 컨텍스트의 조회 가능 구독을 대상으로 합니다. 테넌트 간 통합을 자동 보장하지 않습니다.
- Resource Graph 표는 최대 1,000행입니다. 필터를 좁혀 조회하세요. Peering의 mv-expand는 서비스 한도에 영향을 받으므로 매우 큰 VNet은 개별 리소스에서도 확인하세요.
- 지표 분할 시 상위 20개 시계열을 표시합니다. 전체 터널·피어 수가 더 많으면 Metrics 탐색기에서 개별 필터를 적용하세요.
- 구성·로그·지표의 리소스 유형은 VNet 기반 VPN/ExpressRoute와 VNet Peering입니다. Virtual WAN, ExpressRoute Direct 포트, NSG/VNet Flow Logs 및 Azure Firewall 분석은 이 통합 화면의 범위에 포함하지 않습니다.
- 로그 수집·보존·Connection Monitor에는 사용량 비용이 발생할 수 있습니다. Workspace를 선택하지 않아도 구성·네이티브 지표는 사용할 수 있습니다.
- Workbook은 조회 화면이며 경보를 자동 전송하지 않습니다. 운영 경보는 Azure Monitor 경고 규칙으로 별도 구성하세요.

## 출처
[원본 Azure Firewall Workbook](https://github.com/Azure/Azure-Network-Security/tree/1f98d7a10514817932abdff168ea28ec5cfa847c/Azure%20Firewall/Workbook%20-%20Azure%20Firewall%20Monitor%20Workbook)의 매개변수·탭·Resource Graph·로그 조회 및 ARM 배포 구조를 기반으로 재구성했습니다. MIT 라이선스와 원본 스냅샷을 별도로 보존합니다.

[설정 및 문제 해결](https://github.com/${repository}#readme) · [VPN 지표](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-virtualnetworkgateways-metrics) · [ExpressRoute 지표](https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-expressroutecircuits-metrics)`),
      ]),
    ],
  };
}

export function createTemplate(workbook) {
  const data = structuredClone(workbook);
  const params = data.items.find(item => item.name === 'global-filters').content.parameters;
  params.find(p => p.name === 'Subscriptions').value = ["[subscription().subscriptionId]"];
  params.find(p => p.name === 'Workspace').value = "[parameters('workspaceResourceId')]";
  return {
    $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
    contentVersion: '1.0.0.0',
    metadata: {
      description: '한국어 Azure 통합 네트워크 모니터링 Workbook. 기존 네트워크와 진단 설정은 변경하지 않습니다.',
      source: `https://github.com/${repository}`,
    },
    parameters: {
      workbookDisplayName: { type: 'string', defaultValue: 'Azure 통합 네트워크 모니터', minLength: 1, maxLength: 256, metadata: { description: '공유 Workbook의 표시 이름입니다.' } },
      location: { type: 'string', defaultValue: '[resourceGroup().location]', metadata: { description: 'Workbook을 저장할 Azure 지역입니다. 모니터링 대상 리소스 지역과 달라도 됩니다.' } },
      workspaceResourceId: { type: 'string', defaultValue: '', metadata: { description: '선택 사항: 기존 Log Analytics 작업 영역 전체 리소스 ID입니다. 비워두면 배포 후 선택할 수 있습니다.' } },
      workbookId: { type: 'string', defaultValue: "[guid(resourceGroup().id, parameters('workbookDisplayName'))]", metadata: { description: 'Workbook GUID입니다. 같은 리소스 그룹·표시 이름으로 재배포하면 기존 Workbook을 업데이트합니다.' } },
    },
    variables: { workbookData: data },
    resources: [{
      type: 'Microsoft.Insights/workbooks', apiVersion: '2022-04-01',
      name: "[parameters('workbookId')]", location: "[parameters('location')]", kind: 'shared',
      properties: {
        displayName: "[parameters('workbookDisplayName')]", category: 'workbook',
        serializedData: "[string(variables('workbookData'))]", version: '1.0', sourceId: 'Azure Monitor',
      },
    }],
    outputs: {
      workbookResourceId: { type: 'string', value: "[resourceId('Microsoft.Insights/workbooks', parameters('workbookId'))]" },
      workbookPortalUrl: { type: 'string', value: "[concat('https://portal.azure.com/#@', tenant().tenantId, '/resource', resourceId('Microsoft.Insights/workbooks', parameters('workbookId')), '/workbook')]" },
    },
  };
}

export function outputs() {
  const workbook = createWorkbook();
  return {
    'network-monitor.workbook': workbook,
    'azuredeploy.json': createTemplate(workbook),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  for (const [file, value] of Object.entries(outputs())) {
    const body = `${JSON.stringify(value, null, 2)}\n`;
    const path = resolve(root, file);
    if (check) {
      if (readFileSync(path, 'utf8') !== body) throw new Error(`${file}: npm run build로 생성 파일을 갱신하세요.`);
    } else {
      writeFileSync(path, body);
    }
    console.log(`${check ? '검증' : '생성'}: ${file}`);
  }
}
