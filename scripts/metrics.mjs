const vpn = 'microsoft.network/virtualnetworkgateways';
const circuit = 'microsoft.network/expressroutecircuits';

// Workbook metric IDs include the provider's category; aggregation: 1=Sum, 3=Maximum, 4=Average.
export const metrics = {
  vpnBandwidth: [vpn, 'Traffic', 'TunnelAverageBandwidth', 4, 'ConnectionName', '터널 평균 대역폭 (바이트/초)'],
  vpnIngress: [vpn, 'Traffic', 'TunnelIngressBytes', 1, 'ConnectionName', '터널 수신량 (바이트/구간)'],
  vpnEgress: [vpn, 'Traffic', 'TunnelEgressBytes', 1, 'ConnectionName', '터널 송신량 (바이트/구간)'],
  vpnIngressDrop: [vpn, 'Errors', 'TunnelIngressPacketDropCount', 1, 'ConnectionName', '수신 드롭 (패킷/구간)'],
  vpnEgressDrop: [vpn, 'Errors', 'TunnelEgressPacketDropCount', 1, 'ConnectionName', '송신 드롭 (패킷/구간)'],
  vpnBgp: [vpn, 'Routing', 'BgpPeerStatus', 4, 'BgpPeerAddress', 'BGP 피어 상태 (0/1)'],
  vpnLearned: [vpn, 'Routing', 'BgpRoutesLearned', 1, 'BgpPeerAddress', '학습 경로 (합계/구간)'],
  vpnAdvertised: [vpn, 'Routing', 'BgpRoutesAdvertised', 1, 'BgpPeerAddress', '광고 경로 (합계/구간)'],
  vpnP2s: [vpn, 'Traffic', 'P2SConnectionCount', 1, 'Protocol', 'P2S 연결 (합계/구간)'],
  vpnP2sBandwidth: [vpn, 'Traffic', 'P2SBandwidth', 4, 'Instance', 'P2S 대역폭 (바이트/초)'],
  erBgp: [circuit, 'Circuit Availability', 'BgpAvailability', 4, 'Peer', 'BGP 가용성 (%)'],
  erArp: [circuit, 'Circuit Availability', 'ArpAvailability', 4, 'Peer', 'ARP 가용성 (%)'],
  erIngress: [circuit, 'Circuit Traffic', 'BitsInPerSecond', 4, 'DeviceRole', 'Azure 수신 (비트/초)'],
  erEgress: [circuit, 'Circuit Traffic', 'BitsOutPerSecond', 4, 'DeviceRole', 'Azure 송신 (비트/초)'],
  erIngressUtilization: [circuit, 'Circuit Traffic', 'IngressBandwidthUtilization', 3, 'DeviceRole', '수신 대역폭 사용률 (최대 %)'],
  erEgressUtilization: [circuit, 'Circuit Traffic', 'EgressBandwidthUtilization', 3, 'DeviceRole', '송신 대역폭 사용률 (최대 %)'],
  erGatewayCpu: [vpn, 'Performance', 'ExpressRouteGatewayCpuUtilization', 4, 'roleInstance', '게이트웨이 CPU (%)'],
  erGatewayBandwidth: [vpn, 'Performance', 'ExpressRouteGatewayBitsPerSecond', 4, 'roleInstance', '게이트웨이 수신 (비트/초)'],
};

export const metricSources = {
  [vpn]: 'https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-virtualnetworkgateways-metrics',
  [circuit]: 'https://learn.microsoft.com/azure/azure-monitor/reference/supported-metrics/microsoft-network-expressroutecircuits-metrics',
};
