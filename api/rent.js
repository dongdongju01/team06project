/**
 * Vercel Serverless Function (api/rent.js)
 * 
 * 1. Vercel 환경변수(process.env.SERVICE_KEY)를 서버에서 안전하게 읽음
 * 2. 브라우저 CORS(Cross-Origin) 에러 완벽 해결
 * 3. 깃허브에 키 노출 없이 실시간 국토교통부 XML 수신
 */

export default async function handler(req, res) {
  // CORS 허용 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { lawdCd = '11110', dealYmd = '202312' } = req.query;

  // Vercel 대시보드에 등록된 환경변수 읽기
  const serviceKey = (process.env.SERVICE_KEY || '').trim();

  if (!serviceKey) {
    return res.status(500).json({
      error: 'Vercel 환경변수에 SERVICE_KEY가 설정되지 않았습니다. Vercel Settings -> Environment Variables를 확인하세요.'
    });
  }

  try {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent?serviceKey=${encodeURIComponent(serviceKey)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=150`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`공공데이터 API 응답 에러: HTTP ${response.status}`);
    }

    const xmlText = await response.text();

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xmlText);
  } catch (error) {
    console.error('Vercel API Proxy 에러:', error);
    return res.status(500).json({ error: error.message });
  }
}
