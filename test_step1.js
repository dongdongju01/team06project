/**
 * 1단계 로직 검증 테스트 스크립트 (Node.js)
 * 실행: node test_step1.js
 */

import { SAMPLE_XML_DATA } from './js/mockData.js';
import { parseRentXml } from './js/parser.js';
import { calculateConvertedDeposit, filterTransactions, calculateStatistics, evaluatePriceSuitability, analyzeProperty } from './js/calculator.js';

console.log('====================================================');
console.log('🚀 [방값판독기] 1단계: 파싱 & 적정성 판정 로직 검증 시작');
console.log('====================================================\n');

// 1. XML 파싱 테스트
console.log('1️⃣ [XML 파싱 테스트]');
const parseResult = parseRentXml(SAMPLE_XML_DATA);
console.log(`- 결과: ${parseResult.success ? '성공 ✅' : '실패 ❌'}`);
console.log(`- 메시지: ${parseResult.message}`);
console.log(`- 파싱된 전체 데이터 건수: ${parseResult.data.length}건`);

if (parseResult.data.length > 0) {
  console.log('- 첫 번째 데이터 샘플:');
  console.log(JSON.stringify(parseResult.data[0], null, 2));
}

console.log('\n----------------------------------------------------\n');

// 2. 환산보증금 계산 검증
console.log('2️⃣ [환산보증금 계산식 검증 (기본 전환율 5.5% 기준)]');
// 예시 1: 보증금 15,000만원 + 월세 45만원 -> 15000 + (45 * 12 / 0.055) = 15000 + 9818.18... = 24818.2만원
const testDeposit = 15000;
const testRent = 45;
const converted = calculateConvertedDeposit(testDeposit, testRent, 0.055);
console.log(`- 보증금 ${testDeposit}만원 / 월세 ${testRent}만원`);
console.log(`- 환산보증금: ${converted}만원 (기대값: 약 24,818.2만원)`);

console.log('\n----------------------------------------------------\n');

// 3. 필터링 및 통계 산출 검증
console.log('3️⃣ [조건 필터링 (평창동, 면적 73㎡ ±15%, 연립/다세대 전체)]');
const targetArea = 73.0; // ㎡
const filtered = filterTransactions(parseResult.data, {
  umdNm: '평창동',
  houseType: '전체',
  targetArea: targetArea,
  tolerance: 0.15
});

console.log(`- 필터링 통과 건수: ${filtered.length}건 (면적 범위: ${(targetArea * 0.85).toFixed(1)}㎡ ~ ${(targetArea * 1.15).toFixed(1)}㎡)`);
filtered.forEach((item, idx) => {
  console.log(`  [${idx + 1}] ${item.mhouseNm} (${item.houseType}) ${item.excluUseAr}㎡ | 보증금: ${item.deposit}만 / 월세: ${item.monthlyRent}만 -> 환산: ${item.convertedDeposit}만원`);
});

const stats = calculateStatistics(filtered);
console.log('\n- 산출된 5수치 요약 통계:');
console.log(`  * 최저가: ${stats.min.toLocaleString()}만원`);
console.log(`  * Q1 (하위 25%): ${stats.q1.toLocaleString()}만원`);
console.log(`  * 중앙값 (Median): ${stats.median.toLocaleString()}만원`);
console.log(`  * 평균가 (Average): ${stats.average.toLocaleString()}만원`);
console.log(`  * Q3 (상위 25%): ${stats.q3.toLocaleString()}만원`);
console.log(`  * 최고가: ${stats.max.toLocaleString()}만원`);

console.log('\n----------------------------------------------------\n');

// 4. 매물 등급 판정 시나리오 검증
console.log('4️⃣ [적정성 판정 등급 시나리오 검증 (주변 중앙값 대비)]');

const testCases = [
  { name: '시나리오 A-1 (비정상적 저렴 매물 -50%)', deposit: 12250, rent: 0 }, // 환산 12,250만원 (중앙값 24,500 대비 -50%)
  { name: '시나리오 A-2 (안심 시세 매물 -7%)', deposit: 22700, rent: 0 },       // 환산 22,700만원 (중앙값 24,500 대비 -7.3%)
  { name: '시나리오 B (적정 시세 매물)', deposit: 24500, rent: 0 },             // 환산 24,500만원 (괴리율 0%)
  { name: '시나리오 C (다소 비싼 매물)', deposit: 27500, rent: 0 },             // 환산 27,500만원 (괴리율 +12.2%)
  { name: '시나리오 D (위험/호갱 매물)', deposit: 32000, rent: 0 }              // 환산 32,000만원 (괴리율 +30.6%)
];

testCases.forEach(tc => {
  const result = analyzeProperty({
    umdNm: '평창동',
    houseType: '전체',
    excluUseAr: targetArea,
    deposit: tc.deposit,
    monthlyRent: tc.rent
  }, parseResult.data);

  console.log(`[${tc.name}] 내 매물: 보증금 ${tc.deposit}만 / 월세 ${tc.rent}만 (환산: ${result.myProperty.convertedDeposit.toLocaleString()}만원)`);
  console.log(`  -> 괴리율: ${result.evaluation.disparityRate > 0 ? '+' : ''}${result.evaluation.disparityRate}%`);
  console.log(`  -> 판정 등급: ${result.evaluation.badge} (${result.evaluation.grade})`);
  console.log(`  -> 안내 코멘트: "${result.evaluation.comment}"\n`);
});

console.log('====================================================');
console.log('🎉 1단계 핵심 엔진 검증 완료!');
console.log('====================================================');

