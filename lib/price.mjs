// Pine comparison operands rounded to nine fractional digits.
export const priceRound=x=>Math.round(x*1e9)/1e9,lt=(a,b)=>priceRound(a)<priceRound(b),gt=(a,b)=>priceRound(a)>priceRound(b),le=(a,b)=>priceRound(a)<=priceRound(b),ge=(a,b)=>priceRound(a)>=priceRound(b);
