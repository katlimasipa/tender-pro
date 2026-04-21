export const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

export const formatZAR = (n: number) => ZAR.format(Number.isFinite(n) ? n : 0);

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
