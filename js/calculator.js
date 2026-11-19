/**
 * 통계 계산 및 적정성 판정 엔진 (js/calculator.js)
 * 
 * 1. 전월세 환산보증금 계산
 * 2. 조건별 필터링 (법정동, 주택유형, 면적 ±15%)
 * 3. 5수치 요약 통계(최저, Q1, 중앙값, 평균, Q3, 최고)
 * 4. 괴리율 계산 및 4단계 적정성 등급 판정
 */

import { CONFIG } from '../config.js';

/**
 * 보증금과 월세를 전월세전환율을 적용하여 환산보증금으로 변환합니다.
 * 환산보증금 = 보증금 + (월세 * 12 / conversionRate)
 * 
 * @param {number} deposit 보증금 (만원)
 * @param {number} monthlyRent 월세 (만원)
 * @param {number} conversionRate 전월세전환율 (예: 0.055)
 * @returns {number} 환산보증금 (만원 단위, 소수점 둘째 자리 반올림)
 */
export function calculateConvertedDeposit(deposit, monthlyRent, conversionRate = CONFIG.DEFAULT_CONVERSION_RATE) {
  const dep = Number(deposit) || 0;
  const rent = Number(monthlyRent) || 0;
  const rate = Number(conversionRate) > 0 ? Number(conversionRate) : CONFIG.DEFAULT_CONVERSION_RATE;

  if (rent === 0) {
    return Math.round(dep);
  }

  const converted = dep + (rent * 12) / rate;
  return Math.round(converted * 10) / 10; // 소수점 첫째자리까지
}

/**
 * 거래 데이터 목록을 조건에 따라 필터링합니다.
 * @param {Array} records 원본 거래 데이터
 * @param {Object} criteria 필터 조건 { umdNm, houseType, targetArea, tolerance }
 * @returns {Array} 필터링 및 환산보증금이 추가된 레코드 배열
 */
export function filterTransactions(records, criteria = {}) {
  const {
    umdNm = '',
    houseType = '전체', // '전체' | '연립' | '다세대'
    targetArea = null, // ㎡
    tolerance = CONFIG.AREA_TOLERANCE, // 기본 0.15 (±15%)
    conversionRate = CONFIG.DEFAULT_CONVERSION_RATE
  } = criteria;

  const minArea = targetArea ? targetArea * (1 - tolerance) : 0;
  const maxArea = targetArea ? targetArea * (1 + tolerance) : Infinity;

  return records.filter(item => {
    // 1. 법정동 일치 여부 (입력되었을 경우)
    if (umdNm && item.umdNm !== umdNm) {
      return false;
    }

    // 2. 주택 유형 필터 ('전체'가 아닐 경우)
    if (houseType && houseType !== '전체' && item.houseType !== houseType) {
      return false;
    }

    // 3. 전용면적 ±15% 범위 필터
    if (targetArea) {
      if (item.excluUseAr < minArea || item.excluUseAr > maxArea) {
        return false;
      }
    }

    return true;
  }).map(item => ({
    ...item,
    convertedDeposit: calculateConvertedDeposit(item.deposit, item.monthlyRent, conversionRate)
  }));
}

/**
 * 정렬된 숫자 배열에서 백분위수(Percentile)를 구합니다. (선형 보간법)
 */
function getPercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];

  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedArray[lower];
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * 비교 거래 데이터의 통계 지표(최저가, Q1, 중앙값, 평균, Q3, 최고가)를 계산합니다.
 * @param {Array} filteredRecords filterTransactions를 통과한 데이터 목록
 * @returns {Object|null} 통계 결과 객체
 */
export function calculateStatistics(filteredRecords) {
  if (!filteredRecords || filteredRecords.length === 0) {
    return null;
  }

  const values = filteredRecords
    .map(r => r.convertedDeposit)
    .filter(val => typeof val === 'number' && !isNaN(val))
    .sort((a, b) => a - b);

  const count = values.length;
  if (count === 0) return null;

  const min = values[0];
  const max = values[count - 1];
  const q1 = Math.round(getPercentile(values, 25));
  const median = Math.round(getPercentile(values, 50));
  const q3 = Math.round(getPercentile(values, 75));
  
  const sum = values.reduce((acc, cur) => acc + cur, 0);
  const average = Math.round((sum / count) * 10) / 10;

  return {
    count,
    min,
    q1,
    median,
    average,
    q3,
    max,
    values
  };
}

/**
 * 괴리율 계산 및 적정성 등급 판정
 * 
 * 괴리율(%) = ((내 매물 환산보증금 - 주변 중앙값) / 주변 중앙값) * 100
 * 
 * 등급:
 * - 🟣 의심: < -10% (시세 대비 지나치게 저렴 -> 권리관계/사기/하자 확인 필요)
 * - 🟢 안심: -10% 이상 ~ -5% 미만 (시세 이하)
 * - 🔵 적정: -5% 이상 ~ +10% 이하 (평균 수준)
 * - 🟡 주의: +10% 초과 ~ +20% 이하 (다소 높음)
 * - 🔴 위험: > +20% (호갱 주의)
 * 
 * @param {number} myConvertedDeposit 내 매물의 환산보증금 (만원)
 * @param {number} marketMedian 주변 실거래 중앙값 (만원)
 * @returns {Object} 등급 평가 결과
 */
export function evaluatePriceSuitability(myConvertedDeposit, marketMedian) {
  if (!marketMedian || marketMedian <= 0) {
    return {
      disparityRate: 0,
      grade: '알수없음',
      gradeCode: 'UNKNOWN',
      badge: '⚪ 확인불가',
      color: '#6b7280',
      comment: '비교 가능한 주변 실거래 데이터가 충분하지 않습니다.'
    };
  }

  // 괴리율 계산 (소수점 첫째자리 반올림)
  const disparityRate = Math.round(((myConvertedDeposit - marketMedian) / marketMedian) * 1000) / 10;

  let grade = '';
  let gradeCode = '';
  let badge = '';
  let color = '';
  let comment = '';

  if (disparityRate < -10) {
    grade = '의심 (비정상적 저렴)';
    gradeCode = 'SUSPICIOUS';
    badge = '🟣 의심 (과도한 저렴)';
    color = '#8b5cf6'; // purple
    comment = '주변 시세보다 지나치게 저렴합니다! 선순위 대출(근저당), 불법/위반건축물, 하자 또는 허위매물 여부를 반드시 확인하세요.';
  } else if (disparityRate < -5) {
    grade = '안심 (시세 이하)';
    gradeCode = 'SAFE';
    badge = '🟢 안심';
    color = '#10b981'; // green
    comment = '주변 시세보다 저렴한 편입니다.';
  } else if (disparityRate <= 10) {
    grade = '적정 (평균 수준)';
    gradeCode = 'MODERATE';
    badge = '🔵 적정';
    color = '#3b82f6'; // blue
    comment = '적정 시세 범위 내에 있습니다.';
  } else if (disparityRate <= 20) {
    grade = '주의 (다소 높음)';
    gradeCode = 'CAUTION';
    badge = '🟡 주의';
    color = '#f59e0b'; // amber/yellow
    comment = '주변 평균보다 다소 높습니다. 옵션이나 신축 여부를 확인하세요.';
  } else {
    grade = '위험 (호갱 주의)';
    gradeCode = 'DANGER';
    badge = '🔴 위험';
    color = '#ef4444'; // red
    comment = '주변 시세보다 현저히 비쌉니다. 계약 전 시세와 조건을 재확인하세요.';
  }

  return {
    disparityRate,
    grade,
    gradeCode,
    badge,
    color,
    comment
  };
}

/**
 * 1단계 통합 분석 실행 함수 (3단계 예외 처리 고도화 반영)
 * 매물 조건과 거래 원본 데이터를 받아 최종 분석 결과를 산출합니다.
 * 
 * [3단계 예외 처리 규칙]
 * - 1차 필터링: 면적 ±15%
 * - 표본 5건 미만 시: 면적 범위를 ±25%로 자동 확장하여 재계산
 */
export function analyzeProperty(myProperty, rawRecords, conversionRate = CONFIG.DEFAULT_CONVERSION_RATE) {
  // 1. 내 매물 환산보증금 계산
  const myConvertedDeposit = calculateConvertedDeposit(
    myProperty.deposit,
    myProperty.monthlyRent,
    conversionRate
  );

  // 2. 유사 거래 데이터 1차 필터링 (동일 동, 주택유형, 면적 ±15%)
  let tolerance = CONFIG.AREA_TOLERANCE || 0.15;
  let isExpanded = false;

  let filteredRecords = filterTransactions(rawRecords, {
    umdNm: myProperty.umdNm,
    houseType: myProperty.houseType,
    targetArea: myProperty.excluUseAr,
    tolerance,
    conversionRate
  });

  // 3. 표본 5건 미만 시 면적 ±25%로 자동 확장
  if (filteredRecords.length > 0 && filteredRecords.length < 5 && myProperty.excluUseAr > 0) {
    tolerance = 0.25;
    isExpanded = true;
    filteredRecords = filterTransactions(rawRecords, {
      umdNm: myProperty.umdNm,
      houseType: myProperty.houseType,
      targetArea: myProperty.excluUseAr,
      tolerance,
      conversionRate
    });
  }

  // 4. 주변 통계 산출
  const stats = calculateStatistics(filteredRecords);

  // 5. 적정성 판정 (통계가 있을 경우 중앙값 기준)
  const evaluation = stats ? evaluatePriceSuitability(myConvertedDeposit, stats.median) : null;

  return {
    myProperty: {
      ...myProperty,
      convertedDeposit: myConvertedDeposit
    },
    filterCriteria: {
      umdNm: myProperty.umdNm,
      houseType: myProperty.houseType || '전체',
      targetArea: myProperty.excluUseAr,
      tolerance,
      isExpanded,
      minArea: myProperty.excluUseAr ? Math.round(myProperty.excluUseAr * (1 - tolerance) * 10) / 10 : 0,
      maxArea: myProperty.excluUseAr ? Math.round(myProperty.excluUseAr * (1 + tolerance) * 10) / 10 : 0,
      conversionRate
    },
    stats,
    evaluation,
    filteredRecords
  };
}

