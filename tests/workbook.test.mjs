import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    assert.equal(items.filter(item => item.type === 12 && item.conditionalVisibility.value === link.subTarget).length, 1);
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
  assert.deepEqual(defaults.find(p => p.name === 'Subscriptions').value, ['[subscription().subscriptionId]']);
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
      assert.ok(value.startsWith('[[') || ["[subscription().subscriptionId]", "[parameters('workspaceResourceId')]"].includes(value), `Unescaped ARM literal: ${value}`);
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
      for (const text of [name, metricSources[namespace], criterion.meaning, criterion.unit, criterion.review]) {
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

test('framework mapping distinguishes CAF from WAF and never asserts universal official thresholds', () => {
  assert.match(frameworkCriteria, /CAF의 공식 네 가지 축을 그대로 인용한 분류는 아닙니다/);
  assert.match(frameworkCriteria, /Security/);
  assert.match(frameworkCriteria, /공식 경보 임계값이 아닌 운영 해석/);
  assert.match(frameworkCriteria, /공통 임계값을 Microsoft 권장값으로 제시하지 않습니다/);
  for (const c of categories) assert.ok(frameworkCriteria.includes(c.pillar));
  assert.match(nonMetricCriteria, /플랫폼 Metrics가 아닌/);
  assert.match(nonMetricCriteria, /전체 검사 0이면 null/);
});
