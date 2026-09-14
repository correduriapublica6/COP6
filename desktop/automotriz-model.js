(function (global) {
  const SCALE = [
    { label: "Muy malo", value: 0.5 },
    { label: "Malo", value: 0.75 },
    { label: "Regular", value: 0.9 },
    { label: "Bueno", value: 1 },
    { label: "Muy bueno", value: 1.15 },
    { label: "Excelente", value: 1.3 },
  ];

  const FUNCTIONAL_GROUPS = {
    carroceria: ["Motor", "Estructura", "Tapicería", "Pintura", "Toldo"],
    componentes: ["Llantas", "Transmisión", "Dirección", "Suspensión", "Sistema eléctrico", "Accesorios"],
  };

  const ECONOMIC_FACTORS = ["Uso actual", "Situación de mercado", "Propósito del avalúo", "Oferta", "Demanda", "Otros"];

  function average(values) {
    const numeric = values.map(Number).filter((value) => Number.isFinite(value));
    if (!numeric.length) return 0;
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  }

  function calculateObsolescence({ functionalGroupOne = [], functionalGroupTwo = [], economic = [] } = {}) {
    const firstFunctionalAverage = average(functionalGroupOne);
    const secondFunctionalAverage = average(functionalGroupTwo);
    const functional = average([firstFunctionalAverage, secondFunctionalAverage]);
    const economicAverage = average(economic);
    const factor = (functional + economicAverage + economicAverage) / 3;
    const demerit = 1 - factor;

    return {
      firstFunctionalAverage,
      secondFunctionalAverage,
      functional,
      economic: economicAverage,
      factor,
      demerit,
    };
  }

  function numericValue(value) {
    return Math.max(0, Number(String(value || "").replace(",", ".")) || 0);
  }

  function convertToPesos(value, currency = "MXN", exchangeRate = 1) {
    const amount = numericValue(value);
    return String(currency).toUpperCase() === "MXN" ? amount : amount * numericValue(exchangeRate);
  }

  function normalizePercentage(value) {
    const numeric = numericValue(value);
    return numeric > 1 ? numeric / 100 : numeric;
  }

  function roundToPeso(value) {
    return Math.round(numericValue(value));
  }

  function calculateMarketValue({ quantity = 1, unitValue = 0, factor = 1 } = {}) {
    const amount = numericValue(unitValue);
    const qty = numericValue(quantity);
    const coefficient = numericValue(factor);
    const demeritRate = 1 - coefficient;
    const demeritAmount = amount * demeritRate;
    const netUnitValue = amount - demeritAmount;
    const netValue = netUnitValue * qty;
    return { quantity: qty, unitValue: amount, coefficient, demeritRate, demeritAmount, netUnitValue, netValue, roundedNetValue: roundToPeso(netValue) };
  }

  function calculateReplacementValue({ quantity = 1, unitValue = 0, coefficient = 0 } = {}) {
    const amount = numericValue(unitValue);
    const qty = numericValue(quantity);
    const demeritRate = normalizePercentage(coefficient);
    const demeritAmount = amount * demeritRate;
    const netUnitValue = amount - demeritAmount;
    const netValue = netUnitValue * qty;
    return { quantity: qty, unitValue: amount, coefficient: demeritRate, demeritAmount, netUnitValue, netValue, roundedNetValue: roundToPeso(netValue) };
  }

  const UNITS = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const TENS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  function underHundred(value) {
    if (value < 20) return UNITS[value];
    if (value < 30) return value === 20 ? "VEINTE" : `VEINTI${UNITS[value - 20].toLowerCase()}`.toUpperCase();
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    return unit ? `${TENS[ten]} Y ${UNITS[unit]}` : TENS[ten];
  }

  function underThousand(value) {
    if (value === 100) return "CIEN";
    const hundred = Math.floor(value / 100);
    const remainder = value % 100;
    if (!hundred) return underHundred(remainder);
    return remainder ? `${HUNDREDS[hundred]} ${underHundred(remainder)}` : HUNDREDS[hundred];
  }

  function numberToSpanish(value) {
    const amount = roundToPeso(value);
    if (amount < 1000) return underThousand(amount);
    if (amount < 1000000) {
      const thousands = Math.floor(amount / 1000);
      const remainder = amount % 1000;
      const prefix = thousands === 1 ? "MIL" : `${underThousand(thousands)} MIL`;
      return remainder ? `${prefix} ${underThousand(remainder)}` : prefix;
    }
    if (amount < 1000000000) {
      const millions = Math.floor(amount / 1000000);
      const remainder = amount % 1000000;
      const prefix = millions === 1 ? "UN MILLÓN" : `${numberToSpanish(millions)} MILLONES`;
      return remainder ? `${prefix} ${numberToSpanish(remainder)}` : prefix;
    }
    return String(amount);
  }

  function amountInWords(value) {
    return `SON: ${numberToSpanish(value)} PESOS 00/100 M.N.`;
  }

  const api = { SCALE, FUNCTIONAL_GROUPS, ECONOMIC_FACTORS, average, calculateObsolescence, convertToPesos, calculateMarketValue, calculateReplacementValue, roundToPeso, amountInWords };
  global.AutomotrizModel = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
