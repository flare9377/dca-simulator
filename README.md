# DCA Portfolio Dashboard (MVP)

개인용 **DCA 포트폴리오 대시보드**입니다.  
현재는 **BTC/ETH 중심**으로 구현되어 있고, 구조는 주식/ETF 확장(가격 Provider 분리, 통화/환율 확장 테이블 포함)을 전제로 설계되어 있습니다.

## 아키텍처 (요약)

- **Frontend / Backend**: Next.js App Router (React + TypeScript)
  - UI: Tailwind CSS
  - Charts: Recharts
- **DB**: SQLite
- **ORM**: Prisma (추후 PostgreSQL로 전환 용이)
- **Price Providers (추상화)**:
  - `CoinGeckoProvider`: BTC/ETH 현재가 조회
  - `Manual/LastKnownProvider`: API 장애 시 마지막 저장가(PriceSnapshot)로 fallback
  - Provider chaining: `chainProviders([coingecko, manual])`

## 폴더 구조

```
src/
  app/
    api/
      assets/
      transactions/
      portfolio/
    page.tsx
  lib/
    db/prisma.ts
    portfolio/calc.ts
    prices/
      types.ts
      providers/
        chain.ts
        coingecko.ts
        manual.ts
prisma/
  schema.prisma
  seed.ts
```

## 데이터 모델 (Prisma)

- `Asset`: 자산 마스터 (symbol, name, assetType, currency)
- `Transaction`: 거래 내역 (buy/sell, date, price, quantity, fee, currency, memo)
- `PriceSnapshot`: 가격 스냅샷 (source, timestamp) — API 실패 시 fallback
- (확장용) `ExchangeRate`, `PortfolioSnapshot`

스키마는 `prisma/schema.prisma` 참고.

## 계산 로직 (명확한 기준)

### 평균 매수가 / 투자금 / 보유수량

MVP는 **이동평균법(가중평균 단가)** 를 기본으로 채택합니다.

- 매수(buy)
  - invested += price × qty + fee
  - quantity += qty
- 매도(sell)
  - 평균단가(avg) = invested / quantity
  - invested -= avg × qtySold
  - quantity -= qtySold

> 현재 UI는 매수 입력만 노출하지만, 모델/계산은 매도 확장 가능하게 구현되어 있습니다.

구현: `src/lib/portfolio/calc.ts`

## 로컬 실행 방법

### 1) 설치

```bash
cd dca-dashboard
npm install
```

### 2) DB 마이그레이션

```bash
npm run db:migrate
```

### 3) 샘플 데이터(요구된 테스트 케이스) 넣기

```bash
npm run db:seed
```

### 4) 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 단위 테스트

요구된 예시 데이터(BTC/ETH DCA) 기준으로 평균 매수가/손익/수익률이 맞는지 검증합니다.

```bash
npm test
```

테스트 파일: `src/lib/portfolio/calc.test.ts`

## API (MVP)

- `GET /api/assets`
- `POST /api/assets`
- `GET /api/transactions`
- `POST /api/transactions`
- `DELETE /api/transactions/:id`
- `GET /api/portfolio`  
  - 자산/거래 내역을 기반으로 수익률을 계산하고,
  - 현재가를 Provider로 조회 (실패 시 마지막 저장가 fallback),
  - CoinGecko 성공 시 `PriceSnapshot`으로 저장

## 향후 확장 포인트

- Stock/ETF Provider 추가 (`StockPriceProvider` 구현 후 `chainProviders`에 연결)
- 환율 자동 반영 (`ExchangeRate` 적재 + 통화 변환 레이어)
- `PortfolioSnapshot`을 주기적으로 적재하여 기간별 수익률 차트 구현
- CSV 업로드/리밸런싱/세금 계산 보조 등

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
