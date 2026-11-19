/**
 * XML 파싱 및 데이터 정제 모듈 (js/parser.js)
 * 국토교통부 연립다세대 전월세 실거래가 API 응답을 정제된 자바스크립트 객체 배열로 변환합니다.
 */

/**
 * XML 문자열을 파싱하여 정제된 거래 데이터 객체 배열을 반환합니다.
 * @param {string} xmlString 
 * @returns {{ success: boolean, data: Array, message: string }}
 */
export function parseRentXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    return { success: false, data: [], message: 'XML 데이터가 비어있거나 올바르지 않습니다.' };
  }

  // 1. DOMParser 지원 여부 확인 (브라우저 vs Node.js)
  if (typeof DOMParser !== 'undefined') {
    return parseWithDomParser(xmlString);
  } else {
    // Node.js 환경에서의 폴백 파서
    return parseWithRegexFallback(xmlString);
  }
}

/**
 * 브라우저 표준 DOMParser를 사용한 파싱
 */
function parseWithDomParser(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // 파싱 에러 태그 검사
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    return { success: false, data: [], message: 'XML 문법 파싱 오류가 발생했습니다.' };
  }

  // resultCode 검사 ('000' 또는 '00'이 정상)
  const resultCode = getXmlTagValue(xmlDoc, 'resultCode');
  const resultMsg = getXmlTagValue(xmlDoc, 'resultMsg') || '';

  if (resultCode !== '000' && resultCode !== '00') {
    return {
      success: false,
      data: [],
      message: `API 응답 오류 [코드: ${resultCode}]: ${resultMsg}`
    };
  }

  const items = xmlDoc.getElementsByTagName('item');
  const records = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const record = extractItemData((tag) => getXmlTagValue(item, tag));
    if (record) {
      records.push(record);
    }
  }

  return {
    success: true,
    data: records,
    message: `${records.length}건의 거래 내역을 정상적으로 파싱했습니다.`
  };
}

/**
 * 단일 태그 텍스트값 추출 도우미
 */
function getXmlTagValue(parentElement, tagName) {
  const el = parentElement.getElementsByTagName(tagName)[0];
  return el && el.textContent ? el.textContent.trim() : '';
}

/**
 * Node.js 등 DOMParser가 없는 환경을 위한 정규식 기반 폴백 파서
 */
function parseWithRegexFallback(xmlString) {
  const resultCodeMatch = xmlString.match(/<resultCode>(.*?)<\/resultCode>/);
  const resultCode = resultCodeMatch ? resultCodeMatch[1].trim() : '';
  const resultMsgMatch = xmlString.match(/<resultMsg>(.*?)<\/resultMsg>/);
  const resultMsg = resultMsgMatch ? resultMsgMatch[1].trim() : '';

  if (resultCode !== '000' && resultCode !== '00') {
    return {
      success: false,
      data: [],
      message: `API 응답 오류 [코드: ${resultCode}]: ${resultMsg}`
    };
  }

  const itemMatches = xmlString.match(/<item>[\s\S]*?<\/item>/g) || [];
  const records = [];

  for (const itemXml of itemMatches) {
    const getTag = (tag) => {
      const match = itemXml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return match ? match[1].trim() : '';
    };

    const record = extractItemData(getTag);
    if (record) {
      records.push(record);
    }
  }

  return {
    success: true,
    data: records,
    message: `${records.length}건의 거래 내역을 정상적으로 파싱했습니다.`
  };
}

/**
 * 공통: 원시 문자열 태그에서 정제된 레코드 객체 생성
 */
function extractItemData(getValueFn) {
  const rawDeposit = getValueFn('deposit');
  const rawRent = getValueFn('monthlyRent');
  const rawArea = getValueFn('excluUseAr');

  // 금액 쉼표(,) 제거 및 숫자 변환
  const deposit = parseNumber(rawDeposit);
  const monthlyRent = parseNumber(rawRent);
  const excluUseAr = parseFloat(rawArea) || 0;

  // 면적이 없거나 유효하지 않은 경우 제외
  if (excluUseAr <= 0) return null;

  const year = getValueFn('dealYear');
  const month = String(getValueFn('dealMonth')).padStart(2, '0');
  const day = String(getValueFn('dealDay')).padStart(2, '0');
  const dealDate = (year && month && day) ? `${year}.${month}.${day}` : '';

  return {
    sggCd: getValueFn('sggCd'),
    umdNm: getValueFn('umdNm'),
    houseType: getValueFn('houseType') || '연립', // '연립' or '다세대'
    mhouseNm: getValueFn('mhouseNm') || '건물명 미상',
    jibun: getValueFn('jibun'),
    buildYear: parseInt(getValueFn('buildYear'), 10) || null,
    dealDate,
    dealYear: parseInt(year, 10) || null,
    dealMonth: parseInt(month, 10) || null,
    dealDay: parseInt(day, 10) || null,
    deposit,        // 만원 단위 숫자
    monthlyRent,    // 만원 단위 숫자
    excluUseAr,     // ㎡ 단위 소수점 숫자
    floor: parseInt(getValueFn('floor'), 10) || null,
    contractType: getValueFn('contractType') || '일반'
  };
}

/**
 * 쉼표 제거 및 숫자 정제 도우미
 */
function parseNumber(value) {
  if (!value) return 0;
  const cleanStr = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

