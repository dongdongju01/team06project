/**
 * 공공데이터포털 국토교통부 연립다세대 전월세 실거래가 API 호출 모듈 (js/api.js)
 */

import { CONFIG } from '../config.js';
import { SAMPLE_XML_DATA } from './mockData.js';
import { parseRentXml } from './parser.js';

/**
 * 실거래가 API를 호출하거나 Mock 데이터를 불러옵니다.
 * 
 * @param {Object} params
 * @param {string} params.lawdCd 법정동코드 5자리 (예: 11110)
 * @param {string} params.dealYmd 계약년월 6자리 (예: 202312)
 * @param {string} [params.serviceKey] 공공데이터포털 인증키 (생략 시 config.js 참조)
 * @param {boolean} [params.useMock] Mock 데이터 강제 사용 여부
 * @returns {Promise<{ success: boolean, data: Array, rawXml: string, message: string, isMock: boolean }>}
 */
export async function fetchRentTransactions({
  lawdCd = '11110',
  dealYmd = '202312',
  serviceKey = '',
  useMock = false
}) {
  const key = (serviceKey || CONFIG.SERVICE_KEY || '').trim();

  // 1. Mock 데이터 모드이거나 인증키가 입력되지 않은 경우 샘플 데이터 반환
  if (useMock || !key || key.includes('여기에_')) {
    const parseResult = parseRentXml(SAMPLE_XML_DATA);
    return {
      success: parseResult.success,
      data: parseResult.data,
      rawXml: SAMPLE_XML_DATA,
      message: key && !key.includes('여기에_')
        ? '테스트 모드로 Mock 데이터를 불러왔습니다.'
        : '⚠️ API 키가 설정되지 않아 테스트용 샘플(Mock) 데이터를 불러왔습니다. config.js에서 인증키를 입력해주세요.',
      isMock: true
    };
  }

  // 2. 실제 API 호출
  try {
    // 공공데이터포털 serviceKey는 이미 인코딩된 키인 경우와 디코딩된 키인 경우가 있음
    // encodeURIComponent 여부를 처리
    const queryParams = new URLSearchParams({
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      numOfRows: '200'
    });

    // serviceKey는 브라우저 URLSearchParams에서 이중 인코딩되는 문제를 방지하기 위해 직접 결합
    const url = `${CONFIG.API_BASE_URL}?serviceKey=${encodeURIComponent(key)}&${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP 에러 발생: 상태 코드 ${response.status}`);
    }

    const xmlText = await response.text();
    const parseResult = parseRentXml(xmlText);

    if (!parseResult.success) {
      // API 응답 자체가 에러(resultCode !== '000')인 경우
      return {
        success: false,
        data: [],
        rawXml: xmlText,
        message: parseResult.message,
        isMock: false
      };
    }

    return {
      success: true,
      data: parseResult.data,
      rawXml: xmlText,
      message: `공공데이터포털 실시간 데이터 ${parseResult.data.length}건을 성공적으로 수신했습니다.`,
      isMock: false
    };
  } catch (error) {
    console.error('API 호출 실패:', error);

    // 브라우저 CORS 문제 또는 네트워크 문제 시
    const isCorsError = error.name === 'TypeError' && error.message.includes('fetch');
    let errorMsg = `API 호출 실패: ${error.message}`;

    if (isCorsError) {
      errorMsg = '공공데이터포털 API 직접 호출 중 브라우저 보안(CORS) 제한이 발생했습니다. 테스트를 위해 샘플 데이터로 대체합니다.';
    }

    // 실패 시 안전하게 Mock 데이터로 Fallback 제공
    const fallbackResult = parseRentXml(SAMPLE_XML_DATA);
    return {
      success: true,
      data: fallbackResult.data,
      rawXml: SAMPLE_XML_DATA,
      message: `${errorMsg} (Mock 데이터로 자동 전환되었습니다.)`,
      isMock: true
    };
  }
}

