# AIRFARO MAP · 동국대학교 서울캠퍼스 시범

흡연 의심 공기 변화 센서가 보낸 값을 3D 캠퍼스 지도에 보여 주는 학생 프로젝트 화면이에요. **실물 검증 전 시범**이에요.

- 기둥은 공기 변화를 재는 **센서 위치**예요. 흡연한 사람의 위치가 아니에요.
- 먼지 · 가스 값의 변화만 봐요. 니코틴이나 흡연 여부를 확정하지 않아요.
- 값이 30초 넘게 오지 않으면 회색(수신 없음)으로 바뀌고, 서버에 닿지 않으면 예시 데이터라고 분명히 적어요.
- 길을 걷는 학생 캐릭터는 화면을 꾸미는 가상 캐릭터예요. 실제 사람의 위치도, 냄새를 잰 값도 아니에요.
- '내 캐릭터'로 만든 방문자 캐릭터도 꾸밈용이에요. 서버에는 생김새와 이름 낱말의 번호, 세운 자리를 저장해요. 브라우저와 IP 는 sha256 값으로만 남기고, 누구나 읽는 목록에는 넣지 않아요. 7일 동안 다시 오지 않으면 지워요.
- 건물은 OpenStreetMap 윤곽과 높이로 만든 모형이에요. 팔정도 불상과 코끼리 석상, 명진관, 신공학관 · 중앙도서관 · 정보문화관 · 다향관 외벽은 공개된 사진을 보고 모양과 색을 넣었고, 정각원과 종각은 기와지붕으로, 옥상 정원은 기사를 보고 그렸어요. 크기와 색, 창문 수는 실제와 달라요. 사진은 보고 참고만 했고 지도에 붙이지 않았어요.

## 파일
- `index.html` 지도 화면 · `map3d.js` 3D 지도 · `judge.js` 판단 규칙 · `core.js` 공개 서버와 같은 상태 계산
- `campus-data.js` 건물 · 길 · 고도 (OpenStreetMap 과 AWS Terrain Tiles 에서 만든 자료)
- `S_collector.html` 장치(USB)에서 값을 받아 서버로 보내는 수집 페이지
- `vendor/` three.js r147 (MIT, `vendor/three.LICENSE.txt`)

## 자료 출처
- 건물 · 길: © OpenStreetMap 기여자, [ODbL](https://opendatacommons.org/licenses/odbl/) · `campus-data.js` 는 OpenStreetMap 자료를 고쳐 만든 것이라 같은 ODbL 로 써요
- 고도: AWS Terrain Tiles (SRTM 기반)
- 건물 · 조각상 모양 참고: Wikimedia Commons 와 언론에 실린 사진 (보고 참고만 했어요)
- 3D: [three.js](https://threejs.org) (MIT)

이 폴더는 AIRFARO 프로젝트의 `dev/make_public_copy.py` 로 만들었어요. 직접 고치지 말고 원본을 고친 뒤 다시 만들어요.
