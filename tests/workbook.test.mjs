import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorkbook, createTemplate, root, deployUrl, templateUrl, outputs } from '../scripts/build.mjs';
import { metrics, metricSources } from '../scripts/metrics.mjs';
import * as queries from '../scripts/queries.mjs';

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
  assert.equal(links.length, 6);
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
  assert.equal(charts.length, 15);
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
