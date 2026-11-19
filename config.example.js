/**
 * 설정 예시 파일 (config.example.js)
 * 
 * 💡 이 프로젝트를 클론(Clone)받으신 분은 이 파일을 복사하여 `config.js`로 이름을 바꾼 뒤,
 * 아래 SERVICE_KEY에 발급받으신 공공데이터포털 인증키를 입력하시면 됩니다.
 */

var CONFIG = {
  // 공공데이터포털(data.go.kr) 일반 인증키(Decoding 키)를 입력하세요.
  SERVICE_KEY: '여기에_공공데이터포털_인증키를_입력하세요',

  API_BASE_URL: 'https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  DEFAULT_CONVERSION_RATE: 0.055,
  AREA_TOLERANCE: 0.15
};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
