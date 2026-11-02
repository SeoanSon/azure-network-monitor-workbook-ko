import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createWorkbook, createTemplate, root, deployUrl, templateUrl, outputs } from '../scripts/build.mjs';
import { metrics, metricSources } from '../scripts/metrics.mjs';
import * as queries from '../scripts/queries.mjs';
import { categories, metricCriteria, metricCriteriaTable, frameworkCriteria, costCriteria, nonMetricCriteria } from '../scripts/criteria.mjs';

function flatten(items) {
  return items.flatMap(item => [item, ...flatten(item.content.items ?? [])]);
}

const workbook = createWorkbook();
const items = flatten(workbook.items);
const parameters = items.flatMap(item => item.content.parameters ?? []);
const names = new Set(parameters.map(p => p.name));

test('all generated deliverables match their editable sources', () => {
  for (const [file, value] of Object.entries(outputs())) {
    assert.deepEqual(JSON.parse(readFileSync(resolve(root, file), 'utf8')), value);
  }
});

test('each panel and parameter has a stable unique name', () => {
  assert.equal(new Set(items.map(item => item.name)).size, items.length);
  assert.equal(names.size, parameters.length);
  assert.ok(items.length >= 50);
});

test('all workbook parameter references and conditions resolve', () => {
  const body = JSON.stringify(workbook);
  for (const match of body.matchAll(/\{([A-Za-z][A-Za-z0-9]*)(?::[^}]+)?\}/g)) {
    assert.ok(names.has(match[1]), `Undeclared parameter: ${match[1]}`);
  }
  for (const item of items) {
    if (item.conditionalVisibility) assert.ok(names.has(item.conditionalVisibility.parameterName));
    if (item.content.resourceParameter) assert.ok(names.has(item.content.resourceParameter));
  }
});

test('every navigation target has one visible tab group and Korean label', () => {
  const links = items.find(item => item.name === 'navigation').content.links;
  assert.equal(links.length, 7);
  for (const link of links) {
    assert.match(link.linkLabel, /[가-힣]/);
    assert.ok(names.has(link.cellValue));
    assert.equal(items.filter(item => item.type === 12 && item.conditionalVisibility?.value === link.subTarget).length, 1);
  }
  assert.equal(parameters.find(p => p.name === 'Tab').value, 'overview');
});

test('ARM creates only one shared workbook and never changes networking or telemetry', () => {
  const template = createTemplate(workbook);
  assert.equal(template.resources.length, 1);
  const resource = template.resources[0];
  assert.equal(resource.type, 'Microsoft.Insights/workbooks');
  assert.equal(resource.kind, 'shared');
  assert.equal(resource.apiVersion, '2022-04-01');
  assert.equal(resource.properties.serializedData, "[string(variables('workbookData'))]");
  assert.match(template.parameters.workbookId.defaultValue, /guid\(resourceGroup\(\)\.id/);
  assert.equal(template.parameters.workspaceResourceId.defaultValue, '');
  const defaults = template.variables.workbookData.items.find(i => i.name === 'global-filters').content.parameters;
  assert.deepEqual(defaults.find(p => p.name === 'Subscriptions').value, ['[subscription().id]']);
  assert.equal(defaults.find(p => p.name === 'Workspace').value, "[parameters('workspaceResourceId')]");
});

test('native metrics have a resource selector, time context, supported namespace and dimensions', () => {
  const charts = items.filter(item => item.type === 10);
  assert.equal(charts.length, 26);
  for (const chart of charts) {
    const c = chart.content;
    assert.equal(c.version, 'MetricsItem/2.0');
    assert.equal(c.timeContextFromParameter, 'TimeRange');
    assert.deepEqual(c.resourceIds, [`{${c.resourceParameter}}`]);
    for (const metric of c.metrics) {
      assert.equal(metric.namespace, c.resourceType);
      assert.ok(metricSources[metric.namespace]);
      assert.ok(Object.values(metrics).some(([ns, category, name, aggregation, splitBy]) =>
        metric.metric === `${ns}-${category}-${name}` && metric.aggregation === aggregation && metric.splitBy === splitBy));
      assert.equal(metric.splitByLimit, 20);
      assert.match(metric.columnName, /[가-힣]/);
    }
  }
});

test('metric units, aggregation semantics, errors category and redundancy are retained', () => {
  assert.equal(metrics.vpnBandwidth[2], 'TunnelAverageBandwidth');
  assert.equal(metrics.vpnBandwidth[3], 4);
  assert.equal(metrics.vpnIngressDrop[1], 'Errors');
  assert.equal(metrics.vpnEgressDrop[1], 'Errors');
  assert.equal(metrics.vpnP2s[3], 1);
  assert.equal(metrics.vpnBgp[3], 4);
  assert.equal(metrics.erBgp[4], 'Peer');
  assert.equal(metrics.erArp[4], 'Peer');
  assert.equal(metrics.erIngress[4], 'DeviceRole');
  assert.equal(metrics.erGatewayCpu[4], 'roleInstance');
  for (const name of ['er-private-bgp', 'er-private-arp', 'er-private-traffic']) {
    assert.deepEqual(items.find(i => i.name === name).content.filters[0].values, ['private']);
  }
  assert.equal(items.find(i => i.name === 'er-other-bgp').content.filters[0].operator, 1);
});

test('all ARG data panels, selectors and Log Analytics queries apply subscription and group scope', () => {
  for (const item of items.filter(i => i.type === 3)) {
    assert.match(item.content.query, /\{Subscriptions\}/, item.name);
    assert.match(item.content.query, /\{ResourceGroups\}/, item.name);
  }
  for (const name of ['VpnGateway', 'Circuit', 'ErGateway']) {
    const p = parameters.find(p => p.name === name);
    assert.match(p.query, /\{Subscriptions\}/);
    assert.match(p.query, /\{ResourceGroups\}/);
    assert.equal(p.multiSelect, false);
  }
  const groups = parameters.find(p => p.name === 'ResourceGroups');
  assert.equal(groups.typeSettings.selectAllValue, '*');
  assert.deepEqual(groups.value, ['value::all']);
});

test('logs are optional, time-scoped and queried through the selected workspace only', () => {
  assert.equal(parameters.find(p => p.name === 'Workspace').isRequired, false);
  for (const panel of items.filter(i => i.type === 3 && i.content.queryType === 0)) {
    assert.deepEqual(panel.content.crossComponentResources, ['{Workspace}']);
    assert.equal(panel.content.timeContextFromParameter, 'TimeRange');
    assert.match(panel.content.query, /TimeGenerated \{TimeRange\}/);
    assert.deepEqual(panel.conditionalVisibility, { parameterName: 'Workspace', comparison: 'isNotEqualTo', value: '' });
    assert.match(panel.content.query, /union isfuzzy=true/);
  }
  for (const name of ['diagnostics-coverage', 'activity-coverage', 'connectivity-coverage']) {
    assert.match(items.find(i => i.name === name).content.query, /데이터 없음|측정 없음/);
  }
});

test('peering is based on directional VNet properties and never claims data-plane health', () => {
  assert.match(queries.peerings, /properties\.virtualNetworkPeerings/);
  assert.match(queries.peerings, /FullyInSync/);
  assert.match(queries.peerings, /동기화 상태 미보고/);
  assert.match(items.find(i => i.name === 'peering-note').content.json, /성공을 보장하지 않습니다/);
  assert.match(items.find(i => i.name === 'connectivity-note').content.json, /Connection Monitor 리소스/);
});

test('connectivity failure rate is weighted by checks and zero-count denominator stays unknown', () => {
  assert.match(queries.connectivity, /sum\(ChecksFailed\)/);
  assert.match(queries.connectivity, /sum\(ChecksTotal\)/);
  assert.match(queries.connectivity, /real\(null\)/);
  assert.match(queries.connectivity, /sumif\(ChecksTotal, isnotnull\(AvgRoundTripTimeMs\)\)/);
  assert.doesNotMatch(queries.connectivity, /avg\(.*Percent/);
});

test('Deploy to Azure URL targets the new public main-branch template and README uses it', () => {
  const prefix = 'https://portal.azure.com/#create/Microsoft.Template/uri/';
  assert.ok(deployUrl.startsWith(prefix));
  assert.equal(decodeURIComponent(deployUrl.slice(prefix.length)), templateUrl);
  assert.match(templateUrl, /SeoanSon\/azure-network-monitor-workbook-ko\/main\/azuredeploy.json$/);
  assert.ok(readFileSync(resolve(root, 'README.md'), 'utf8').includes(deployUrl));
});

test('MIT license and pinned upstream snapshot are preserved, not deployed', () => {
  assert.match(readFileSync(resolve(root, 'LICENSE'), 'utf8'), /Copyright \(c\) Microsoft Corporation/);
  assert.equal(JSON.parse(readFileSync(resolve(root, 'upstream/AzureFirewall_ARM.json'), 'utf8')).contentVersion, '1.0.0.0');
  assert.match(readFileSync(resolve(root, 'NOTICE.md'), 'utf8'), /1f98d7a10514817932abdff168ea28ec5cfa847c/);
});

function visibleItems(items, values) {
  return items.flatMap(item => {
    const condition = item.conditionalVisibility;
    if (condition) {
      assert.ok(['isEqualTo', 'isNotEqualTo'].includes(condition.comparison));
      const equal = values[condition.parameterName] === condition.value;
      if (condition.comparison === 'isEqualTo' ? !equal : equal) return [];
    }
    return [item, ...visibleItems(item.content.items ?? [], values)];
  });
}

const selections = {
  Tab: 'overview', MonitoringCategory: 'performance',
  Workspace: '/selected-workspace', VpnGateway: '/selected-vpn',
  Circuit: '/selected-circuit', ErGateway: '/selected-er-gateway',
};

test('Overview is the default criteria tab and the original resource inventory remains separate', () => {
  const overview = visibleItems(workbook.items, selections);
  assert.ok(overview.some(i => i.name === 'overview-framework'));
  assert.ok(overview.some(i => i.name === 'overview-complementary'));
  assert.ok(!overview.some(i => i.type === 3 || i.type === 10));
  const inventory = visibleItems(workbook.items, { ...selections, Tab: 'resources' });
  for (const name of ['summary', 'inventory', 'connections']) assert.ok(inventory.some(i => i.name === name));
});

test('the category picker contains exactly the four requested Korean viewpoints', () => {
  const picker = parameters.find(p => p.name === 'MonitoringCategory');
  assert.equal(picker.type, 2);
  assert.equal(picker.isRequired, true);
  assert.equal(picker.multiSelect, false);
  assert.equal(picker.value, 'performance');
  assert.deepEqual(JSON.parse(picker.jsonData), [
    { value: 'performance', label: '성능' }, { value: 'cost', label: '비용' },
    { value: 'availability', label: '가용성' }, { value: 'operations', label: '운영' },
  ]);
});

test('ARM escapes the static JSON option list without changing the Gallery Template options', () => {
  const data = createTemplate(workbook).variables.workbookData;
  const picker = data.items.find(i => i.name === 'global-filters').content.parameters.find(p => p.name === 'MonitoringCategory');
  assert.ok(picker.jsonData.startsWith('[['));
  assert.deepEqual(JSON.parse(picker.jsonData.slice(1)), JSON.parse(parameters.find(p => p.name === 'MonitoringCategory').jsonData));
  function checkStrings(value) {
    if (typeof value === 'string' && value.startsWith('[')) {
      assert.ok(value.startsWith('[[') || ["[subscription().id]", "[parameters('workspaceResourceId')]"].includes(value), `Unescaped ARM literal: ${value}`);
    } else if (Array.isArray(value)) {
      value.forEach(checkStrings);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(checkStrings);
    }
  }
  checkStrings(data);
});

test('every configured REST metric has official definitions, supported aggregation and complete criteria', () => {
  assert.deepEqual(Object.keys(metricCriteria).sort(), Object.keys(metrics).sort());
  for (const [key, criterion] of Object.entries(metricCriteria)) {
    const [namespace, , name, aggregation, splitBy] = metrics[key];
    assert.ok(criterion.meaning.length > 10, key);
    assert.ok(criterion.review.length > 10, key);
    assert.ok(criterion.unit && criterion.grain, key);
    assert.ok(criterion.dimensions.includes(splitBy), key);
    assert.ok(criterion.aggregations.includes({ 1: 'Total', 3: 'Maximum', 4: 'Average' }[aggregation]), key);
    for (const category of criterion.categories) {
      assert.ok(categories.some(c => c.value === category), key);
      const table = metricCriteriaTable(category);
      const review = category === 'cost' ? criterion.costReview : criterion.review;
      for (const text of [name, metricSources[namespace], criterion.meaning, criterion.unit, review]) {
        assert.ok(table.includes(text), `${key}: missing ${text}`);
      }
    }
  }
});

test('all four viewpoints work on every resource tab without cross-category metric leaks', () => {
  for (const Tab of ['vpn', 'peering', 'expressroute', 'logs']) {
    for (const { value } of categories) {
      const visible = visibleItems(workbook.items, { ...selections, Tab, MonitoringCategory: value });
      const categoryGroups = visible.filter(i => i.type === 12 && i.conditionalVisibility?.parameterName === 'MonitoringCategory');
      assert.equal(categoryGroups.length, 1, `${Tab}/${value}`);
      assert.ok(categoryGroups[0].content.items.length > 0);
      for (const item of visible.filter(i => i.type === 10)) {
        for (const chartMetric of item.content.metrics) {
          const [key] = Object.entries(metrics).find(([, [ns, category, name]]) => chartMetric.metric === `${ns}-${category}-${name}`);
          assert.ok(metricCriteria[key].categories.includes(value), `${Tab}/${value}/${key}`);
        }
      }
    }
  }
});

test('each documented metric is actually visible in every assigned viewpoint for its resource', () => {
  for (const [key, criterion] of Object.entries(metricCriteria)) {
    const [ns, category, name] = metrics[key];
    for (const MonitoringCategory of criterion.categories) {
      const Tab = key.startsWith('vpn') ? 'vpn' : 'expressroute';
      const visible = visibleItems(workbook.items, { ...selections, Tab, MonitoringCategory });
      assert.ok(visible.some(i => i.type === 10 && i.content.metrics.some(m => m.metric === `${ns}-${category}-${name}`)), `${key}/${MonitoringCategory}`);
    }
  }
});

test('category gates retain workspace and resource-selection gates', () => {
  for (const Tab of ['vpn', 'peering', 'expressroute', 'logs']) {
    for (const { value: MonitoringCategory } of categories) {
      const visible = visibleItems(workbook.items, { ...selections, Tab, MonitoringCategory, Workspace: '', VpnGateway: '', Circuit: '', ErGateway: '' });
      assert.ok(!visible.some(i => i.type === 10), `${Tab}/${MonitoringCategory}: metrics need a selected resource`);
      assert.ok(!visible.some(i => i.type === 3 && i.content.queryType === 0), `${Tab}/${MonitoringCategory}: logs need a workspace`);
    }
  }
});

test('cost adds official maximum utilization metrics without inventing billed cost or peering traffic', () => {
  for (const key of ['erIngressUtilization', 'erEgressUtilization']) {
    assert.equal(metrics[key][3], 3);
    assert.equal(metrics[key][4], 'DeviceRole');
    assert.deepEqual(metricCriteria[key].aggregations, ['Maximum']);
  }
  const peeringCost = visibleItems(workbook.items, { ...selections, Tab: 'peering', MonitoringCategory: 'cost' });
  assert.ok(!peeringCost.some(i => i.type === 10 || (i.type === 3 && i.content.queryType === 0)));
  assert.match(costCriteria, /실제 청구 금액·단가·예산·절감액은 조회하거나 계산하지 않습니다/);
  assert.match(costCriteria, /피어링별 전송 바이트를 수집하지 않습니다/);
});

test('framework mapping uses WAF checklists and never asserts universal official thresholds', () => {
  assert.doesNotMatch(frameworkCriteria, /CAF|cloud-adoption-framework/);
  assert.match(frameworkCriteria, /Security/);
  assert.match(frameworkCriteria, /공식 경보 임계값이 아닌 운영 해석/);
  assert.match(frameworkCriteria, /공통 임계값을 Microsoft 권장값으로 제시하지 않습니다/);
  for (const c of categories) {
    assert.ok(frameworkCriteria.includes(c.pillar));
    assert.ok(frameworkCriteria.includes(c.codes));
    assert.ok(frameworkCriteria.includes(`https://learn.microsoft.com/azure/well-architected/${c.reference}/checklist`));
  }
  assert.match(nonMetricCriteria, /플랫폼 Metrics가 아닌/);
  assert.match(nonMetricCriteria, /전체 검사 0이면 null/);
});

test('checkpoint cells state only the metric meaning and when to inspect it, without repetitive caveats', () => {
  for (const { value } of categories) {
    const table = metricCriteriaTable(value);
    assert.match(table, /\| 점검기준 \|/);
    assert.doesNotMatch(table, /선정 이유|선정이유|판정 한계/);
    for (const [key, criterion] of Object.entries(metricCriteria).filter(([, c]) => c.categories.includes(value))) {
      const review = value === 'cost' ? criterion.costReview : criterion.review;
      const checkpoint = `${criterion.meaning} ${review}`;
      assert.equal(checkpoint.split('.').filter(Boolean).length, 2, key);
      assert.ok(checkpoint.length <= 110, `${key}/${value} is too verbose`);
      assert.match(review, /때|장애 시/, `${key}/${value} needs a concrete inspection occasion`);
      assert.doesNotMatch(checkpoint, /청구|간주하지|아닙니다|보장하지|미포함|계산하지|해석하지/, key);
      assert.ok(table.includes(checkpoint), `${key}/${value}`);
    }
  }
  assert.equal(metricCriteria.vpnBandwidth.review, 'VPN 통신이 느려지거나 터널 용량 증설을 검토할 때 확인합니다.');
});

test('reused metrics have distinct performance and cost checkpoints and current docs use WAF only', () => {
  for (const [key, criterion] of Object.entries(metricCriteria)) {
    if (!criterion.categories.includes('cost')) continue;
    assert.ok(criterion.costReview?.length > 10, key);
    assert.notEqual(criterion.costReview, criterion.review, key);
    assert.ok(metricCriteriaTable('performance').includes(criterion.review), key);
    assert.ok(metricCriteriaTable('cost').includes(criterion.costReview), key);
  }
  const generated = JSON.stringify(workbook);
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
  assert.doesNotMatch(generated + readme, /\bCAF\b|cloud-adoption-framework|선정 이유 및 점검 기준/);
  assert.match(nonMetricCriteria, /\| 점검기준 \|/);
});

test('all subscription filters accept picker ARM resource IDs as well as legacy GUIDs', () => {
  const graphFilter = queries.subscriptionFilter();
  const logFilter = queries.subscriptionFilter("tostring(split(_ResourceId, '/')[2])");
  assert.equal(graphFilter, "| where subscriptionId in~ ({Subscriptions}) or strcat('/subscriptions/', subscriptionId) in~ ({Subscriptions})");
  assert.ok(logFilter.includes("strcat('/subscriptions/', tostring(split(_ResourceId, '/')[2]))"));
  for (const item of items.filter(i => i.type === 3)) {
    assert.ok(item.content.query.includes(item.content.queryType === 1 ? graphFilter : logFilter), item.name);
  }
  for (const p of parameters.filter(p => p.query?.includes('subscriptionId in~'))) {
    assert.ok(p.query.includes(graphFilter), p.name);
  }
  assert.match(readFileSync(resolve(root, 'scripts/validate-azure.ps1'), 'utf8'), /else \{ "\/subscriptions\/\$subscription" \}/);
});

test('the peering configuration table remains visible without a VPN gateway or log workspace in every viewpoint', () => {
  for (const { value: MonitoringCategory } of categories) {
    const visible = visibleItems(workbook.items, { ...selections, Tab: 'peering', MonitoringCategory, Workspace: '', VpnGateway: '', Circuit: '', ErGateway: '' });
    const peering = visible.find(i => i.name === 'peerings');
    assert.ok(peering, MonitoringCategory);
    assert.equal(peering.content.queryType, 1);
    assert.deepEqual(peering.content.crossComponentResources, ['{Subscriptions}']);
    assert.ok(!peering.conditionalVisibility);
  }
});

const s2sPanels = [
  ['vpn-s2s-coverage', 'vpnS2sCoverage'],
  ['vpn-s2s-tunnel-trend', 'vpnS2sTunnelTrend'],
  ['vpn-s2s-tunnel-summary', 'vpnS2sTunnelSummary'],
  ['vpn-s2s-tunnel-events', 'vpnS2sTunnelEvents'],
  ['vpn-s2s-dpd-trend', 'vpnS2sDpdTrend'],
  ['vpn-s2s-dpd-events', 'vpnS2sDpdEvents'],
  ['vpn-s2s-ike-raw', 'vpnS2sIkeRaw'],
  ['vpn-s2s-gateway-events', 'vpnS2sGatewayEvents'],
];

function requiredItem(name, candidates = items) {
  const item = candidates.find(item => item.name === name);
  assert.ok(item, `Missing item: ${name}`);
  return item;
}

function s2sQuery(name) {
  assert.equal(typeof queries[name], 'string', `Missing query export: ${name}`);
  assert.ok(queries[name].length > 0, name);
  return queries[name];
}

test('S2S diagnostics are a category-independent VPN group with eight workspace-scoped panels', () => {
  const vpn = requiredItem('vpn-section');
  const diagnostics = requiredItem('vpn-s2s-diagnostics', vpn.content.items);
  assert.equal(diagnostics.type, 12);
  assert.equal(diagnostics.content.version, 'NotebookGroup/1.0');
  assert.equal(diagnostics.conditionalVisibility, undefined);
  requiredItem('vpn-s2s-log-note', diagnostics.content.items);
  requiredItem('vpn-s2s-workspace-empty', diagnostics.content.items);
  requiredItem('vpn-s2s-gateway-empty', diagnostics.content.items);
  const panels = requiredItem('vpn-s2s-log-panels', diagnostics.content.items);
  assert.equal(panels.type, 12);
  assert.equal(panels.content.version, 'NotebookGroup/1.0');
  assert.deepEqual(panels.conditionalVisibility, {
    parameterName: 'VpnGateway', comparison: 'isNotEqualTo', value: '',
  });
  assert.deepEqual(panels.content.items.map(item => item.name).sort(), s2sPanels.map(([name]) => name).sort());
  for (const [name, queryName] of s2sPanels) {
    const panel = requiredItem(name, panels.content.items);
    assert.equal(panel.type, 3, name);
    assert.equal(panel.content.queryType, 0, name);
    assert.equal(panel.content.query, s2sQuery(queryName), name);
    assert.equal(panel.content.timeContextFromParameter, 'TimeRange', name);
    assert.deepEqual(panel.content.crossComponentResources, ['{Workspace}'], name);
    assert.deepEqual(panel.conditionalVisibility, {
      parameterName: 'Workspace', comparison: 'isNotEqualTo', value: '',
    }, name);
  }
});

test('S2S instructions and panels respect every workspace/gateway selection in all four viewpoints', () => {
  for (const { value: MonitoringCategory } of categories) {
    for (const Workspace of ['', selections.Workspace]) {
      for (const VpnGateway of ['', selections.VpnGateway]) {
        const context = `${MonitoringCategory}/workspace=${!!Workspace}/gateway=${!!VpnGateway}`;
        const visible = visibleItems(workbook.items, {
          ...selections, Tab: 'vpn', MonitoringCategory, Workspace, VpnGateway,
        });
        const visibleNames = new Set(visible.map(item => item.name));
        assert.ok(visibleNames.has('vpn-s2s-diagnostics'), context);
        assert.ok(visibleNames.has('vpn-s2s-log-note'), context);
        assert.equal(visibleNames.has('vpn-s2s-workspace-empty'), !Workspace, context);
        assert.equal(visibleNames.has('vpn-s2s-gateway-empty'), !VpnGateway, context);
        for (const [name] of s2sPanels) {
          assert.equal(visibleNames.has(name), !!Workspace && !!VpnGateway, `${context}/${name}`);
        }
      }
    }
  }
  for (const Tab of ['overview', 'resources', 'peering', 'expressroute', 'logs', 'guide']) {
    const visible = visibleItems(workbook.items, { ...selections, Tab });
    assert.ok(!visible.some(item => item.name.startsWith('vpn-s2s-')), Tab);
  }
});

test('every S2S query tolerates missing diagnostics schemas and retains exact shared scope filters', () => {
  for (const [, queryName] of s2sPanels) {
    const query = s2sQuery(queryName);
    assert.match(query, /union\s+isfuzzy=true/, queryName);
    assert.match(query, /datatable\s*\([^]*?\)\s*\[\s*\]/, queryName);
    assert.match(query, /\bAzureDiagnostics\b/, queryName);
    assert.match(query, /_ResourceId\s*=\s*coalesce\s*\(\s*tostring\s*\(\s*column_ifexists\s*\(\s*['_"]_ResourceId['"]/, queryName);
    assert.match(query, /column_ifexists\s*\(\s*['"]ResourceId['"]/, queryName);
    assert.ok(query.includes(queries.subscriptionFilter("tostring(split(_ResourceId, '/')[2])")), queryName);
    assert.ok(query.includes("| where '*' in ({ResourceGroups}) or tostring(split(_ResourceId, '/')[4]) in~ ({ResourceGroups})"), queryName);
    assert.match(query, /TimeGenerated \{TimeRange\}/, queryName);
    assert.match(query, /isnotempty\s*\(\s*['"]\{VpnGateway\}['"]\s*\)/, queryName);
    assert.match(query, /_ResourceId\s*=~\s*['"]\{VpnGateway\}['"]/, queryName);
    for (const column of ['Message', 'OperationName', 'remoteIP_s', 'instance_s', 'Level']) {
      assert.match(query, new RegExp(`column_ifexists\\s*\\(\\s*['"]${column}['"]`), `${queryName}/${column}`);
    }
    assert.doesNotMatch(query, /workspace\s*\(|\bsearch\s+in\s*\(/i, queryName);
  }
});

test('S2S messages prioritize raw Message and IKE evidence retains peer and instance fallbacks', () => {
  for (const [, queryName] of s2sPanels) {
    const query = s2sQuery(queryName);
    assert.match(query, /coalesce\s*\(\s*tostring\s*\(\s*column_ifexists\s*\(\s*['"]Message['"]/, queryName);
  }
  for (const queryName of ['vpnS2sDpdTrend', 'vpnS2sDpdEvents', 'vpnS2sIkeRaw']) {
    const query = s2sQuery(queryName);
    assert.ok(query.includes('(원문에서 피어 확인)'), queryName);
    assert.match(query, /(?:Instance|인스턴스)\S*\s*=\s*(?:coalesce|iff|case)\s*\(/i, queryName);
    assert.match(query, /IKEDiagnosticLog/, queryName);
  }
  assert.match(s2sQuery('vpnS2sIkeRaw'), /(?:Message|메시지|원문)/);
});

test('S2S tunnel and DPD trends use selected time grain and preserve peer/instance dimensions', () => {
  for (const [name, queryName] of [
    ['vpn-s2s-tunnel-trend', 'vpnS2sTunnelTrend'],
    ['vpn-s2s-dpd-trend', 'vpnS2sDpdTrend'],
  ]) {
    assert.equal(requiredItem(name).content.visualization, 'timechart', name);
    const query = s2sQuery(queryName);
    assert.match(query, /summarize[^]*\bby\b[^]*bin\s*\(\s*TimeGenerated\s*,\s*\{TimeRange:grain\}\s*\)/, queryName);
    const dimensions = query.slice(query.lastIndexOf('summarize'));
    assert.match(dimensions, /Peer|피어/i, queryName);
    assert.match(dimensions, /Instance|인스턴스/i, queryName);
    assert.doesNotMatch(dimensions, /\b(?:take|top)\s+\d+/i, queryName);
  }
  assert.match(s2sQuery('vpnS2sTunnelTrend'), /TunnelDiagnosticLog/);
  assert.match(s2sQuery('vpnS2sTunnelSummary'), /TunnelDiagnosticLog/);
  assert.match(s2sQuery('vpnS2sTunnelSummary'), /summarize/);
});

test('S2S detail panels select the latest 1000 events before displaying chronological order', () => {
  for (const queryName of ['vpnS2sTunnelEvents', 'vpnS2sDpdEvents', 'vpnS2sIkeRaw', 'vpnS2sGatewayEvents']) {
    const query = s2sQuery(queryName);
    const latest = /(?:\|\s*top\s+1000\s+by\s+([^\r\n]+?)\s+desc\b|\|\s*(?:order|sort)\s+by\s+([^\r\n]+?)\s+desc\s*\|\s*(?:take|limit)\s+1000\b)/i.exec(query);
    assert.ok(latest, `${queryName}: select newest 1000 first`);
    const chronological = /\|\s*(?:order|sort)\s+by\s+([^\r\n]+?)\s+asc\b/i.exec(query.slice(latest.index + latest[0].length));
    assert.ok(chronological, `${queryName}: then display oldest to newest`);
    const newestColumn = (latest[1] ?? latest[2]).trim();
    const oldestColumn = chronological[1].trim();
    if (newestColumn !== oldestColumn) {
      const projection = query.slice(latest.index + latest[0].length, latest.index + latest[0].length + chronological.index);
      assert.ok(projection.includes(`${oldestColumn} = ${newestColumn}`), `${queryName}: chronological column must be the same timestamp`);
    }
  }
  assert.match(s2sQuery('vpnS2sTunnelEvents'), /TunnelDiagnosticLog/);
  assert.match(s2sQuery('vpnS2sGatewayEvents'), /GatewayDiagnosticLog/);
});

test('S2S coverage counts all three diagnostic categories with first/last evidence and zero-data warnings', () => {
  const query = s2sQuery('vpnS2sCoverage');
  for (const category of ['TunnelDiagnosticLog', 'IKEDiagnosticLog', 'GatewayDiagnosticLog']) {
    assert.match(query, new RegExp(`countif\\s*\\([^\\n]*['"]${category}['"]`), category);
  }
  assert.match(query, /min\s*\(\s*TimeGenerated\s*\)/);
  assert.match(query, /max\s*\(\s*TimeGenerated\s*\)/);
  assert.match(query, /(?:==\s*0|0\s*==)/);
  assert.match(query, /Tunnel[^]*IKE|IKE[^]*Tunnel/);
  assert.match(query, /데이터 없음|수집 없음|로그 없음|확인|경고/);
  assert.match(query, /정상[^]*아니|정상[^]*않|의미하지|정상 판정 불가/);
});

test('DPD patterns are exported once and embedded in the shared IKE KQL classifier', () => {
  assert.ok(queries.dpdPatterns && typeof queries.dpdPatterns === 'object');
  assert.deepEqual(Object.keys(queries.dpdPatterns).sort(), ['dpd', 'failure', 'nonEvent', 'timeout']);
  const classification = s2sQuery('vpnIkeClassification');
  for (const [name, pattern] of Object.entries(queries.dpdPatterns)) {
    assert.equal(typeof pattern, 'string', name);
    assert.ok(pattern.length > 0, name);
    // KQL verbatim strings keep backslashes; ordinary string literals escape them.
    assert.ok(classification.includes(pattern) || classification.includes(pattern.replaceAll('\\', '\\\\')), name);
  }
  assert.match(classification, /\bcase\s*\(/);
  assert.match(classification, /matches regex/);
  for (const queryName of ['vpnS2sDpdTrend', 'vpnS2sDpdEvents']) {
    assert.ok(s2sQuery(queryName).includes(classification), queryName);
  }
  assert.doesNotMatch(s2sQuery('vpnS2sIkeRaw'), /where isnotempty\(Signal\)|matches regex/);
  for (const queryName of ['vpnS2sDpdTrend', 'vpnS2sDpdEvents']) {
    assert.doesNotMatch(s2sQuery(queryName), /(?:\[['"](?:장애\s*시간|중단\s*시간|현재\s*상태|근본\s*원인)['"]\]|\b(?:Downtime|RootCause|CurrentStatus)\b)\s*=/i, queryName);
  }
});

test('DPD heuristic distinguishes synthetic failures from normal, configuration and negative messages', () => {
  const patterns = Object.fromEntries(Object.entries(queries.dpdPatterns).map(([name, pattern]) => [name, new RegExp(pattern)]));
  const classify = message => {
    const text = message.toLowerCase();
    if (patterns.nonEvent.test(text)) return '';
    const dpd = patterns.dpd.test(text);
    if (dpd && patterns.timeout.test(text)) return 'dpd-timeout';
    if (dpd && patterns.failure.test(text)) return 'dpd-failure';
    if (!dpd && (patterns.timeout.test(text) || patterns.failure.test(text))) return 'ike-related';
    return '';
  };
  const cases = [
    ['Sending DPD request', ''],
    ['Received DPD response', ''],
    ['Received DPD reply', ''],
    ['DPD packet sent successfully', ''],
    ['DPD timeout configured to 30 seconds', ''],
    ['DPD timeout settings updated', ''],
    ['DPD timeout interval is 30 seconds', ''],
    ['No DPD timeout observed', ''],
    ['No DPD failure observed', ''],
    ['DPD timeout not detected', ''],
    ['DPD timeout disabled', ''],
    ['DPD timeout', 'dpd-timeout'],
    ['DPD timed out for peer', 'dpd-timeout'],
    ['Dead peer detection failed', 'dpd-failure'],
    ['DPD retransmission limit exceeded', 'dpd-timeout'],
    ['DPD peer not responding', 'dpd-timeout'],
    ['DPD timer expired', 'dpd-timeout'],
    ['DPD failure', 'dpd-failure'],
    ['DPD unresponsive', 'dpd-failure'],
    ['IKE negotiation timed out', 'ike-related'],
    ['IKE authentication failed', 'ike-related'],
    ['TunnelDisconnected', ''],
    ['', ''],
  ];
  for (const [message, expected] of cases) assert.equal(classify(message), expected, message);
});

test('ARM workbook serialization preserves all panels and public parameterized defaults', () => {
  const template = createTemplate(workbook);
  const data = structuredClone(template.variables.workbookData);
  const armParameters = data.items.find(item => item.name === 'global-filters').content.parameters;
  for (const name of ['Subscriptions', 'Workspace']) {
    armParameters.find(p => p.name === name).value = structuredClone(parameters.find(p => p.name === name).value);
  }
  armParameters.find(p => p.name === 'MonitoringCategory').jsonData = armParameters.find(p => p.name === 'MonitoringCategory').jsonData.slice(1);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), workbook);
  assert.equal(template.resources[0].properties.serializedData, "[string(variables('workbookData'))]");
  for (const body of [JSON.stringify(workbook), JSON.stringify(template)]) {
    assert.doesNotMatch(body, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  }
  assert.equal(parameters.find(p => p.name === 'Workspace').value, '');
  assert.equal(parameters.find(p => p.name === 'VpnGateway').value, null);
});

test('P2S performance panels move intact into an explicit-load supplement, not the cost viewpoint', () => {
  const performance = requiredItem('vpn-performance');
  const supplement = requiredItem('vpn-p2s-supplement', performance.content.items);
  assert.equal(supplement.type, 12);
  assert.equal(supplement.content.version, 'NotebookGroup/1.0');
  assert.equal(supplement.conditionalVisibility, undefined);
  assert.equal(supplement.content.loadType, 'explicit');
  assert.equal(supplement.content.loadButtonText, 'P2S 보조 지표 펼치기');
  assert.deepEqual(supplement.content.items.map(item => item.name), ['vpn-p2s', 'vpn-p2s-bandwidth']);
  assert.ok(!performance.content.items.some(item => ['vpn-p2s', 'vpn-p2s-bandwidth'].includes(item.name)));
  assert.ok(requiredItem('vpn-cost').content.items.some(item => item.name === 'cost-vpn-p2s-bandwidth'));
});

test('HEAD metrics, non-VPN behavior outside Overview wording, original VPN operations, license and upstream remain unchanged', () => {
  const headFile = path => execFileSync('git', ['show', `HEAD:${path}`], { cwd: root });
  const head = JSON.parse(headFile('network-monitor.workbook').toString('utf8'));
  const headItems = flatten(head.items);
  const byName = list => [...list].sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(byName(items.filter(item => item.type === 10)), byName(headItems.filter(item => item.type === 10)));
  const withoutEditableOverviewText = item => {
    const copy = structuredClone(item);
    for (const child of flatten([copy])) {
      if (child.type === 1 && child.name.startsWith('overview-')) delete child.content.json;
    }
    return copy;
  };
  assert.deepEqual(
    workbook.items.filter(item => item.name !== 'vpn-section').map(withoutEditableOverviewText),
    head.items.filter(item => item.name !== 'vpn-section').map(withoutEditableOverviewText),
  );
  assert.deepEqual(requiredItem('vpn-operations'), requiredItem('vpn-operations', headItems));
  const upstreamPaths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'LICENSE', 'upstream'], {
    cwd: root, encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(upstreamPaths.includes('LICENSE'));
  assert.ok(upstreamPaths.some(path => path.startsWith('upstream/')));
  for (const path of upstreamPaths) {
    assert.deepEqual(readFileSync(resolve(root, ...path.split('/'))), headFile(path), path);
  }
});
