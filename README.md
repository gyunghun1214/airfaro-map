# AIRFARO MAP · 동국대학교 서울캠퍼스 시범

흡연 의심 공기 변화 센서가 보낸 값을 3D 캠퍼스 지도에 보여 주는 학생 프로젝트 화면이에요. **실물 검증 전 시범**이에요.

- 기둥은 공기 변화를 재는 **센서 위치**예요. 흡연한 사람의 위치가 아니에요.
- 먼지 · 가스 값의 변화만 봐요. 니코틴이나 흡연 여부를 확정하지 않아요.
- 값이 30초 넘게 오지 않으면 회색(수신 없음)으로 바뀌고, 서버에 닿지 않으면 예시 데이터라고 분명히 적어요.

## 파일
- `index.html` 지도 화면 · `map3d.js` 3D 지도 · `judge.js` 판단 규칙 · `core.js` 공개 서버와 같은 상태 계산
- `campus-data.js` 건물 · 길 · 고도 (OpenStreetMap 과 AWS Terrain Tiles 에서 만든 자료)
- `S_collector.html` 장치(USB)에서 값을 받아 서버로 보내는 수집 페이지
- `vendor/` three.js r147 (MIT, `vendor/three.LICENSE.txt`)

## 자료 출처
- 건물 · 길: © OpenStreetMap 기여자, [ODbL](https://opendatacommons.org/licenses/odbl/) · `campus-data.js` 는 OpenStreetMap 자료를 고쳐 만든 것이라 같은 ODbL 로 써요
- 고도: AWS Terrain Tiles (SRTM 기반)
- 3D: [three.js](https://threejs.org) (MIT)

이 폴더는 AIRFARO 프로젝트의 `dev/make_public_copy.py` 로 만들었어요. 직접 고치지 말고 원본을 고친 뒤 다시 만들어요.
