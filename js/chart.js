/**
 * 시세 분포 시각화 차트 모듈 (js/chart.js)
 * 
 * 최저가 - Q1 - 중앙값/평균 - Q3 - 최고가 범위(박스플롯 스타일) 및
 * 내 매물의 위치를 직관적으로 표시하는 반응형 SVG 차트
 */

/**
 * 시세 분포 SVG 차트를 생성하여 containerId 엘리먼트에 렌더링합니다.
 * @param {string|HTMLElement} container 엘리먼트 또는 ID
 * @param {Object} stats 통계 객체 { min, q1, median, average, q3, max }
 * @param {number} myDeposit 내 매물 환산보증금 (만원)
 * @param {string} badgeColor 등급 색상 코드 (예: #10b981)
 */
export function renderDistributionChart(container, stats, myDeposit, badgeColor = '#2563eb') {
  const target = typeof container === 'string' ? document.getElementById(container) : container;
  if (!target || !stats) return;

  const { min, q1, median, average, q3, max } = stats;

  // 전체 축 범위 계산 (내 매물이 최소/최대보다 바깥에 있을 경우 축을 확장)
  const dataMin = Math.min(min, myDeposit);
  const dataMax = Math.max(max, myDeposit);
  const padding = (dataMax - dataMin) * 0.12 || 1000;
  const axisMin = Math.max(0, dataMin - padding);
  const axisMax = dataMax + padding;
  const totalRange = axisMax - axisMin;

  // 값을 SVG X좌표(픽셀)로 변환하는 함수
  const width = 760;
  const height = 180;
  const margin = { left: 40, right: 40 };
  const plotWidth = width - margin.left - margin.right;

  const toX = (val) => margin.left + ((val - axisMin) / totalRange) * plotWidth;

  const minX = toX(min);
  const q1X = toX(q1);
  const medX = toX(median);
  const q3X = toX(q3);
  const maxX = toX(max);
  const avgX = toX(average);
  const myX = toX(myDeposit);

  const barY = 95;
  const barHeight = 28;

  // SVG 코드 생성
  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" class="distribution-svg" style="width: 100%; height: auto; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
      <defs>
        <!-- 그라디언트 정의 -->
        <linearGradient id="rangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#93c5fd" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="iqrGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#2563eb" stop-opacity="0.85"/>
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
        </filter>
      </defs>

      <!-- 1. 배경 가이드라인 & 축 -->
      <line x1="${margin.left}" y1="${barY + barHeight / 2}" x2="${width - margin.right}" y2="${barY + barHeight / 2}" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round"/>

      <!-- 2. 전체 실거래가 범위 (Min ~ Max) 캡슐 바 -->
      <rect x="${minX}" y="${barY + 6}" width="${Math.max(4, maxX - minX)}" height="${barHeight - 12}" rx="8" fill="url(#rangeGrad)"/>

      <!-- 3. 핵심 50% 구간 (Q1 ~ Q3 적정 시세 코어) 박스 -->
      <rect x="${q1X}" y="${barY}" width="${Math.max(4, q3X - q1X)}" height="${barHeight}" rx="6" fill="url(#iqrGrad)" filter="url(#shadow)"/>
      <text x="${(q1X + q3X) / 2}" y="${barY + 18}" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="0.5">핵심 시세 구간 (50%)</text>

      <!-- 4. 최저가 / 최고가 틱 및 라벨 -->
      <circle cx="${minX}" cy="${barY + barHeight / 2}" r="5" fill="#64748b"/>
      <text x="${minX}" y="${barY + barHeight + 22}" fill="#64748b" font-size="11" text-anchor="middle" font-weight="600">최저 ${Math.round(min).toLocaleString()}만</text>

      <circle cx="${maxX}" cy="${barY + barHeight / 2}" r="5" fill="#64748b"/>
      <text x="${maxX}" y="${barY + barHeight + 22}" fill="#64748b" font-size="11" text-anchor="middle" font-weight="600">최고 ${Math.round(max).toLocaleString()}만</text>

      <!-- 5. Q1 / Q3 라벨 -->
      <text x="${q1X}" y="${barY - 8}" fill="#3b82f6" font-size="11" text-anchor="middle" font-weight="600">Q1 ${Math.round(q1).toLocaleString()}만</text>
      <text x="${q3X}" y="${barY - 8}" fill="#3b82f6" font-size="11" text-anchor="middle" font-weight="600">Q3 ${Math.round(q3).toLocaleString()}만</text>

      <!-- 6. 중앙값(Median) 세로 기준선 -->
      <line x1="${medX}" y1="${barY - 4}" x2="${medX}" y2="${barY + barHeight + 4}" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
      <rect x="${medX - 42}" y="${barY + barHeight + 34}" width="84" height="22" rx="4" fill="#1e293b"/>
      <text x="${medX}" y="${barY + barHeight + 49}" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">중앙 ${Math.round(median).toLocaleString()}만</text>

      <!-- 7. 내 매물 위치 마커 (상단 핀 및 말풍선) -->
      <g transform="translate(${myX}, ${barY - 35})" filter="url(#shadow)">
        <!-- 말풍선 박스 -->
        <path d="M -55,-28 h 110 a 6,6 0 0 1 6,6 v 20 a 6,6 0 0 1 -6,6 h -49 l -5,7 l -5,-7 h -51 a 6,6 0 0 1 -6,-6 v -20 a 6,6 0 0 1 6,-6 z" fill="${badgeColor}"/>
        <text x="0" y="-12" fill="#ffffff" font-size="12" font-weight="800" text-anchor="middle">
          내 매물: ${Math.round(myDeposit).toLocaleString()}만원
        </text>
        <!-- 타겟 핀 포인트 -->
        <circle cx="0" cy="35" r="6" fill="${badgeColor}" stroke="#ffffff" stroke-width="2.5"/>
        <line x1="0" y1="12" x2="0" y2="35" stroke="${badgeColor}" stroke-width="2" stroke-dasharray="3,2"/>
      </g>
    </svg>
  `;

  target.innerHTML = svgHtml;
}

