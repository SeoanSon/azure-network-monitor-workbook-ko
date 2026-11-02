# 출처 및 변경 안내

이 저장소는 Azure의 공식 제품이나 공식 지원 배포판이 아닌 독립적인 한국어 확장 프로젝트입니다.

## 원본

- 저장소: <https://github.com/Azure/Azure-Network-Security>
- 복제 대상: `Azure Firewall/Workbook - Azure Firewall Monitor Workbook` 디렉터리
- 고정 커밋: `1f98d7a10514817932abdff168ea28ec5cfa847c`
- 원본 스냅샷: [upstream](upstream/)
- 원본 저작권: Copyright (c) Microsoft Corporation.
- 라이선스: [MIT](LICENSE)

원본 저장소의 다른 네트워크 예제 전체를 복제한 것은 아닙니다. 요청의 기준이 된 Firewall Workbook 디렉터리를 선택적으로 복제하고, 새 저장소에서 독립적으로 개발했습니다. 원본에 커밋·브랜치·PR을 생성하지 않습니다.

## 변경 사항

원본의 ARM 기반 `Microsoft.Insights/workbooks` 배포 방식, 전역 매개변수, 탭 탐색, Resource Graph 구성 조회, Log Analytics 이벤트 조회 패턴을 기반으로 새 Workbook을 구현했습니다.

- Firewall 전용 규칙·보안 로그 분석을 VPN Gateway, VNet Peering, ExpressRoute 모니터링으로 대체했습니다.
- 사용자 화면·설명·배포 매개변수·운영 문서를 한국어로 작성했습니다.
- 내보낸 `AzureMetrics` 대신 네이티브 Metrics 데이터 원본을 사용하여 터널·피어·장치 차원을 유지합니다.
- 피어링의 구성 상태와 실제 통신 측정을 구분합니다.
- 선택형 작업 영역, 데이터 부재 경고, 재배포 가능한 Workbook ID, 생성 파일 일관성 검사와 CI를 추가했습니다.

원본 스냅샷은 출처 보존용이며 Deploy to Azure 버튼으로 배포되는 파일이 아닙니다. API 식별자, 리소스 유형, 원본 스냅샷과 MIT 라이선스는 원문을 유지합니다.

## 기술 참조

네이티브 Metrics 항목 형식과 ExpressRoute `PeeringType=private` 필터는 Microsoft의 공개 [Azure Monitor Workbooks 예제](https://github.com/microsoft/Application-Insights-Workbooks/tree/master/Workbooks/Network%20Insights) 및 [스키마](https://github.com/microsoft/Application-Insights-Workbooks/blob/master/schema/workbook.json)를 참조했습니다. 해당 저장소의 저작권 및 MIT 라이선스도 Microsoft Corporation에 있습니다.
