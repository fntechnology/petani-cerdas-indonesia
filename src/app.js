import React from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);


// Plugin untuk error bars
Chart.register({
  id: 'errorBars',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!meta.hidden && dataset.errorBars?.show) {
        meta.data.forEach((element, index) => {
          const { x, y } = element.tooltipPosition();
          // Gunakan errorBar data dari dataset
          const errorValue = dataset.errorBars.values?.[index] || 0;
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, y - errorValue);
          ctx.lineTo(x, y + errorValue);
          ctx.strokeStyle = dataset.errorBars.color;
          ctx.lineWidth = dataset.errorBars.lineWidth;
          ctx.stroke();
          
          // Draw caps
          ctx.beginPath();
          ctx.moveTo(x - dataset.errorBars.width, y - errorValue);
          ctx.lineTo(x + dataset.errorBars.width, y - errorValue);
          ctx.moveTo(x - dataset.errorBars.width, y + errorValue);
          ctx.lineTo(x + dataset.errorBars.width, y + errorValue);
          ctx.stroke();
          ctx.restore();
        });
      }
    });
  }
});

// Place calculateFTable function here, right after calculateRobustANOVA
const calculateFTable = (dfTreatment, dfError, alpha = 0.05) => {
  // Pre-calculated F-values for common degrees of freedom
  const fTableApproximation = {
    // Format: [dfTreatment, dfError, F-value]
    '1,10': 4.96,
    '1,20': 4.35,
    '1,30': 4.17,
    '2,10': 4.10,
    '2,20': 3.49,
    '2,30': 3.32,
    '3,10': 3.71,
    '3,20': 3.10,
    '3,30': 2.92
  };

  // Look up F-value based on degrees of freedom
  const key = `${dfTreatment},${dfError}`;
  const approximateF = fTableApproximation[key];

  if (approximateF) {
    return approximateF;
  }

  // Fallback calculation using a simplified approximation
  const baseF = 4.0;  // Default conservative estimate
  const dfAdjustment = Math.sqrt(dfTreatment * dfError) / (dfTreatment + dfError);
  
  return baseF * (1 - dfAdjustment);
};

// Place checkNormality and checkVarianceHomogeneity functions here
const checkNormality = (data) => {
  // Robust input validation
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('Invalid input for normality check: empty or non-array data');
    return {
      isNormal: false,
      error: 'Invalid input data',
      skewness: null,
      kurtosis: null,
      details: {
        mean: null,
        variance: null,
        stdDev: null
      }
    };
  }

  // More robust normality check
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Improved skewness calculation
  const skewness = data.reduce((sum, x) => 
    sum + Math.pow((x - mean) / stdDev, 3), 0) / n;

  // Improved kurtosis calculation
  const kurtosis = data.reduce((sum, x) => 
    sum + Math.pow((x - mean) / stdDev, 4), 0) / n - 3;

  // Additional checks
  const isNormal = Math.abs(skewness) < 1.96 && Math.abs(kurtosis) < 1.96;

  return {
    isNormal: isNormal,
    skewness: skewness,
    kurtosis: kurtosis,
    interpretation: isNormal 
      ? 'Data appears to be normally distributed' 
      : 'Data deviates from normal distribution',
    details: {
      mean: mean,
      variance: variance,
      stdDev: stdDev,
      sampleSize: n
    }
  };
};

const checkVarianceHomogeneity = (treatmentData) => {
  // Input validation
  if (!Array.isArray(treatmentData) || treatmentData.length === 0) {
    console.warn('Invalid input for variance homogeneity check');
    return {
      error: 'Invalid input data',
      homogeneous: false,
      variances: []
    };
  }

  // More comprehensive variance homogeneity check
  const variances = treatmentData.map(group => {
    if (!group.replications || group.replications.length === 0) {
      console.warn('Empty replication group detected');
      return 0;
    }
    const mean = group.replications.reduce((a, b) => a + b, 0) / group.replications.length;
    return group.replications.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / group.replications.length;
  });

  // Bartlett's test approximation
  const k = variances.length;
  const n = treatmentData.reduce((sum, group) => sum + group.replications.length, 0);
  const pooledVariance = variances.reduce((a, b) => a + b, 0) / k;
  
  // Calculate test statistic
  const bartlettStatistic = (n - k) * Math.log(pooledVariance) - 
    variances.reduce((sum, variance, index) => {
      const groupSize = treatmentData[index].replications.length;
      return sum + (groupSize - 1) * Math.log(variance);
    }, 0);

  // Chi-square approximation for degrees of freedom
  const chiSquareValue = 2 * Math.log(bartlettStatistic);
  const degreesOfFreedom = k - 1;

  const homogeneous = chiSquareValue < 0.05;

  return {
    homogeneous: homogeneous,
    variances: variances,
    bartlettStatistic: bartlettStatistic,
    interpretation: homogeneous 
      ? 'Variances are homogeneous' 
      : 'Significant variance heterogeneity detected',
    details: {
      pooledVariance: pooledVariance,
      chiSquareValue: chiSquareValue,
      degreesOfFreedom: degreesOfFreedom,
      treatmentGroups: k,
      totalSampleSize: n
    }
  };
};

const calculateRobustANOVA = (treatmentData) => {
  // Input validation
  if (!Array.isArray(treatmentData) || treatmentData.length === 0) {
    console.error('Invalid input for ANOVA calculation');
    return {
      error: 'Invalid input data',
      valid: false
    };
  }

  // Assumption Checks
  const normalityChecks = treatmentData.map(group => 
    checkNormality(group.replications)
  );

  const varianceCheck = checkVarianceHomogeneity(treatmentData);

  // Original ANOVA calculations
  const n = treatmentData.reduce((acc, row) => acc + row.replications.length, 0);
  const k = treatmentData.length;
  const r = treatmentData[0].replications.length;

  const totalSum = treatmentData.reduce((acc, row) => 
    acc + row.replications.reduce((sum, val) => sum + val, 0), 0);
  const CF = Math.pow(totalSum, 2) / n;

  const TSS = treatmentData.reduce((acc, row) => 
    acc + row.replications.reduce((sum, val) => sum + Math.pow(val, 2), 0), 0) - CF;

  const TrSS = treatmentData.reduce((acc, row) => {
    const treatmentSum = row.replications.reduce((sum, val) => sum + val, 0);
    return acc + Math.pow(treatmentSum, 2) / r;
  }, 0) - CF;

  const ESS = TSS - TrSS;

  const df_treatment = k - 1;
  const df_error = n - k;
  const df_total = n - 1;

  const MS_treatment = TrSS / df_treatment;
  const MS_error = ESS / df_error;

  const F_value = MS_treatment / MS_error;
  const F_table = calculateFTable(df_treatment, df_error, 0.05);

  // Comprehensive interpretation
  const meetAssumptions = normalityChecks.every(check => check.isNormal) && varianceCheck.homogeneous;
  const recommendedTest = meetAssumptions 
    ? 'Parametrik ANOVA' 
    : 'Non-Parametrik (Kruskal-Wallis)';

  return {
    valid: true,
    assumptions: {
      normality: {
        checks: normalityChecks,
        allNormal: normalityChecks.every(check => check.isNormal)
      },
      varianceHomogeneity: {
        check: varianceCheck,
        homogeneous: varianceCheck.homogeneous
      }
    },
    sources: [
      {
        source: 'Perlakuan',
        df: df_treatment,
        SS: TrSS,
        MS: MS_treatment,
        F_value: F_value,
        F_table: F_table,
        significance: F_value > F_table ? 'Signifikan' : 'Tidak Signifikan'
      },
      {
        source: 'Galat',
        df: df_error,
        SS: ESS,
        MS: MS_error
      },
      {
        source: 'Total',
        df: df_total,
        SS: TSS
      }
    ],
    interpretation: {
      meetAssumptions: meetAssumptions,
      recommendedTest: recommendedTest,
      significanceLevel: F_value > F_table ? 'Signifikan' : 'Tidak Signifikan'
    },
    details: {
      totalSampleSize: n,
      treatmentGroups: k,
      replicationsPerGroup: r,
      MS_error: MS_error
    }
  };
};

// Constants and Configuration
console.log('Loading app.js...');

// Constants and Configuration
console.log('Loading app.js...');

const GEMINI_API_KEY = "AIzaSyAcwroBdyqURbkXLDUkzRQmDTH7FyX0TRA";

// Color constants
const COLORS = {
  primary: '#059669',    // Emerald 600 - Main green
  secondary: '#10b981',  // Emerald 500 - Lighter green
  accent: '#34d399',     // Emerald 400 - Bright green
  success: '#047857',    // Emerald 700 - Dark green
  warning: '#f59e0b',    // Amber - For warnings
  error: '#dc2626',      // Red - For errors
  danger: '#dc2626',     // Red - For errors (alias)
  dark: '#064e3b',       // Emerald 900 - Very dark green
  light: '#ecfdf5',      // Emerald 50 - Very light green
  gray: '#6b7280',       // Cool gray
  safe: '#059669',       // Same as primary
  gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)' // Emerald gradient
};

// Data tanaman
const CROPS = [
  {
    name: 'Padi',
    optimalTemperature: { min: 22, max: 30 },
    waterRequirement: { min: 160, max: 200 },
    soilType: 'Tanah lempung berpasir dengan pH 5.5-7.5',
    bestPlantingMonths: ['Oktober', 'November', 'Maret', 'April'],
    challenges: 'Serangan hama wereng, penyakit blast, dan kekeringan',
    growthPeriod: {
      total: 4, // Total bulan dari tanam sampai panen
      phases: [
        { name: 'Persemaian', duration: 0.5, waterNeed: 'high' },
        { name: 'Vegetatif', duration: 1.5, waterNeed: 'high' },
        { name: 'Reproduktif', duration: 1, waterNeed: 'medium' },
        { name: 'Pemasakan', duration: 1, waterNeed: 'low' }
      ]
    }
  },
  {
    name: 'Jagung',
    optimalTemperature: { min: 20, max: 32 },
    waterRequirement: { min: 100, max: 140 },
    soilType: 'Tanah gembur dengan pH 5.6-7.5',
    bestPlantingMonths: ['September', 'Oktober', 'Februari', 'Maret'],
    challenges: 'Serangan ulat penggerek batang dan kekeringan',
    growthPeriod: {
      total: 3.5, // 3.5 bulan dari tanam sampai panen
      phases: [
        { name: 'Perkecambahan', duration: 0.5, waterNeed: 'medium' },
        { name: 'Vegetatif', duration: 1.5, waterNeed: 'high' },
        { name: 'Pembungaan', duration: 1, waterNeed: 'high' },
        { name: 'Pengisian Biji', duration: 0.5, waterNeed: 'medium' }
      ]
    }
  },
  {
    name: 'Kedelai',
    optimalTemperature: { min: 21, max: 32 },
    waterRequirement: { min: 100, max: 150 },
    soilType: 'Tanah lempung berpasir dengan pH 6.0-7.0',
    bestPlantingMonths: ['Oktober', 'November', 'Februari', 'Maret'],
    challenges: 'Serangan ulat grayak dan penyakit karat daun',
    growthPeriod: {
      total: 3, // 3 bulan dari tanam sampai panen
      phases: [
        { name: 'Perkecambahan', duration: 0.5, waterNeed: 'medium' },
        { name: 'Vegetatif', duration: 1, waterNeed: 'high' },
        { name: 'Pembungaan', duration: 1, waterNeed: 'high' },
        { name: 'Pemasakan', duration: 0.5, waterNeed: 'low' }
      ]
    }
  },
  {
    name: 'Kacang Tanah',
    optimalTemperature: { min: 20, max: 30 },
    waterRequirement: { min: 100, max: 150 },
    soilType: 'Tanah lempung berpasir dengan pH 5.5-6.5',
    bestPlantingMonths: ['April', 'Mei', 'Juni', 'Juli'],
    challenges: 'Serangan penyakit layu dan hama kutu daun',
    growthPeriod: {
      total: 4, // 4 bulan dari tanam sampai panen
      phases: [
        { name: 'Perkecambahan', duration: 0.5, waterNeed: 'medium' },
        { name: 'Vegetatif', duration: 1.5, waterNeed: 'high' },
        { name: 'Pembungaan', duration: 1, waterNeed: 'high' },
        { name: 'Pemasakan', duration: 1, waterNeed: 'medium' }
      ]
    }
  },
  {
    name: 'Singkong',
    optimalTemperature: { min: 24, max: 34 },
    waterRequirement: { min: 50, max: 100 },
    soilType: 'Tanah berpasir dengan pH 4.5-7.5',
    bestPlantingMonths: ['Maret', 'April', 'Mei', 'Juni'],
    challenges: 'Serangan hama tikus dan penyakit busuk batang',
    growthPeriod: {
      total: 8, // 8 bulan dari tanam sampai panen
      phases: [
        { name: 'Pertunasan', duration: 1, waterNeed: 'medium' },
        { name: 'Vegetatif Awal', duration: 2, waterNeed: 'high' },
        { name: 'Vegetatif Lanjut', duration: 3, waterNeed: 'medium' },
        { name: 'Pemasakan Umbi', duration: 2, waterNeed: 'low' }
      ]
    }
  }
];

// Data kota dan cuaca
const CITIES = {
  "Bandung": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 18.4, temperature_max: 28.6, rainfall: 289.7 },
      { month: "Februari", temperature_min: 18.2, temperature_max: 28.5, rainfall: 255.8 },
      { month: "Maret", temperature_min: 18.5, temperature_max: 29.1, rainfall: 247.3 },
      { month: "April", temperature_min: 18.7, temperature_max: 29.3, rainfall: 186.5 },
      { month: "Mei", temperature_min: 18.3, temperature_max: 29.2, rainfall: 142.6 },
      { month: "Juni", temperature_min: 17.8, temperature_max: 28.9, rainfall: 72.4 },
      { month: "Juli", temperature_min: 17.2, temperature_max: 28.7, rainfall: 45.2 },
      { month: "Agustus", temperature_min: 17.1, temperature_max: 29.1, rainfall: 35.8 },
      { month: "September", temperature_min: 17.5, temperature_max: 29.8, rainfall: 82.4 },
      { month: "Oktober", temperature_min: 18.2, temperature_max: 29.7, rainfall: 150.6 },
      { month: "November", temperature_min: 18.6, temperature_max: 29.2, rainfall: 234.8 },
      { month: "Desember", temperature_min: 18.5, temperature_max: 28.8, rainfall: 255.9 }
    ]
  },
  "Malang": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 19.8, temperature_max: 28.5, rainfall: 334.2 },
      { month: "Februari", temperature_min: 19.7, temperature_max: 28.4, rainfall: 298.6 },
      { month: "Maret", temperature_min: 19.9, temperature_max: 28.8, rainfall: 256.4 },
      { month: "April", temperature_min: 19.8, temperature_max: 29.1, rainfall: 167.8 },
      { month: "Mei", temperature_min: 19.2, temperature_max: 29.0, rainfall: 108.5 },
      { month: "Juni", temperature_min: 18.4, temperature_max: 28.5, rainfall: 45.7 },
      { month: "Juli", temperature_min: 17.8, temperature_max: 28.2, rainfall: 26.3 },
      { month: "Agustus", temperature_min: 17.6, temperature_max: 28.6, rainfall: 18.9 },
      { month: "September", temperature_min: 18.2, temperature_max: 29.4, rainfall: 35.6 },
      { month: "Oktober", temperature_min: 19.4, temperature_max: 29.8, rainfall: 98.7 },
      { month: "November", temperature_min: 19.8, temperature_max: 29.3, rainfall: 186.5 },
      { month: "Desember", temperature_min: 19.7, temperature_max: 28.7, rainfall: 276.4 }
    ]
  },
  "Medan": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 23.2, temperature_max: 31.8, rainfall: 179.6 },
      { month: "Februari", temperature_min: 23.3, temperature_max: 32.1, rainfall: 152.4 },
      { month: "Maret", temperature_min: 23.5, temperature_max: 32.4, rainfall: 186.3 },
      { month: "April", temperature_min: 23.7, temperature_max: 32.6, rainfall: 176.8 },
      { month: "Mei", temperature_min: 23.8, temperature_max: 32.7, rainfall: 218.5 },
      { month: "Juni", temperature_min: 23.6, temperature_max: 32.5, rainfall: 168.4 },
      { month: "Juli", temperature_min: 23.4, temperature_max: 32.3, rainfall: 156.7 },
      { month: "Agustus", temperature_min: 23.3, temperature_max: 32.4, rainfall: 188.9 },
      { month: "September", temperature_min: 23.2, temperature_max: 32.2, rainfall: 245.6 },
      { month: "Oktober", temperature_min: 23.1, temperature_max: 31.9, rainfall: 287.4 },
      { month: "November", temperature_min: 23.2, temperature_max: 31.7, rainfall: 265.8 },
      { month: "Desember", temperature_min: 23.2, temperature_max: 31.6, rainfall: 198.7 }
    ]
  },
  "Jakarta": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 23, temperature_max: 31, rainfall: 300 },
      { month: "Februari", temperature_min: 23, temperature_max: 31, rainfall: 280 },
      { month: "Maret", temperature_min: 24, temperature_max: 32, rainfall: 260 },
      { month: "April", temperature_min: 24, temperature_max: 33, rainfall: 240 },
      { month: "Mei", temperature_min: 24, temperature_max: 33, rainfall: 220 },
      { month: "Juni", temperature_min: 23, temperature_max: 32, rainfall: 200 },
      { month: "Juli", temperature_min: 23, temperature_max: 32, rainfall: 190 },
      { month: "Agustus", temperature_min: 23, temperature_max: 32, rainfall: 210 },
      { month: "September", temperature_min: 24, temperature_max: 33, rainfall: 240 },
      { month: "Oktober", temperature_min: 24, temperature_max: 33, rainfall: 270 },
      { month: "November", temperature_min: 24, temperature_max: 32, rainfall: 300 },
      { month: "Desember", temperature_min: 24, temperature_max: 32, rainfall: 320 }
    ]
  },
  "Surabaya": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 24, temperature_max: 32, rainfall: 200 },
      { month: "Februari", temperature_min: 24, temperature_max: 32, rainfall: 190 },
      { month: "Maret", temperature_min: 25, temperature_max: 33, rainfall: 180 },
      { month: "April", temperature_min: 25, temperature_max: 34, rainfall: 170 },
      { month: "Mei", temperature_min: 25, temperature_max: 34, rainfall: 160 },
      { month: "Juni", temperature_min: 24, temperature_max: 33, rainfall: 150 },
      { month: "Juli", temperature_min: 24, temperature_max: 33, rainfall: 140 },
      { month: "Agustus", temperature_min: 24, temperature_max: 33, rainfall: 160 },
      { month: "September", temperature_min: 25, temperature_max: 34, rainfall: 180 },
      { month: "Oktober", temperature_min: 25, temperature_max: 34, rainfall: 200 },
      { month: "November", temperature_min: 25, temperature_max: 33, rainfall: 220 },
      { month: "Desember", temperature_min: 25, temperature_max: 33, rainfall: 240 }
    ]
  },
  "Jambi": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 23, temperature_max: 31, rainfall: 200 },
      { month: "Februari", temperature_min: 23, temperature_max: 32, rainfall: 180 },
      { month: "Maret", temperature_min: 24, temperature_max: 32, rainfall: 170 },
      { month: "April", temperature_min: 24, temperature_max: 33, rainfall: 160 },
      { month: "Mei", temperature_min: 24, temperature_max: 33, rainfall: 140 },
      { month: "Juni", temperature_min: 23, temperature_max: 32, rainfall: 120 },
      { month: "Juli", temperature_min: 23, temperature_max: 32, rainfall: 110 },
      { month: "Agustus", temperature_min: 23, temperature_max: 32, rainfall: 130 },
      { month: "September", temperature_min: 24, temperature_max: 33, rainfall: 150 },
      { month: "Oktober", temperature_min: 24, temperature_max: 33, rainfall: 180 },
      { month: "November", temperature_min: 24, temperature_max: 32, rainfall: 200 },
      { month: "Desember", temperature_min: 23, temperature_max: 31, rainfall: 220 }
    ]
  },
  "Palembang": {
    monthlyWeather: [
      { month: "Januari", temperature_min: 24, temperature_max: 32, rainfall: 220 },
      { month: "Februari", temperature_min: 24, temperature_max: 32, rainfall: 200 },
      { month: "Maret", temperature_min: 24, temperature_max: 33, rainfall: 190 },
      { month: "April", temperature_min: 24, temperature_max: 33, rainfall: 180 },
      { month: "Mei", temperature_min: 24, temperature_max: 33, rainfall: 160 },
      { month: "Juni", temperature_min: 24, temperature_max: 32, rainfall: 140 },
      { month: "Juli", temperature_min: 23, temperature_max: 32, rainfall: 130 },
      { month: "Agustus", temperature_min: 23, temperature_max: 32, rainfall: 140 },
      { month: "September", temperature_min: 24, temperature_max: 33, rainfall: 160 },
      { month: "Oktober", temperature_min: 24, temperature_max: 33, rainfall: 190 },
      { month: "November", temperature_min: 24, temperature_max: 32, rainfall: 210 },
      { month: "Desember", temperature_min: 24, temperature_max: 32, rainfall: 230 }
    ]
  }
};

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const determineSeason = (month) => {
  const drySeasonMonths = ['Juni', 'Juli', 'Agustus', 'September', 'Oktober'];
  const transitionMonths = ['Mei', 'November'];
  
  if (drySeasonMonths.includes(month)) return 'Kemarau';
  if (transitionMonths.includes(month)) return 'Transisi';
  return 'Hujan';
};

const checkGrowthPeriodSuitability = (startMonth, crop, cityWeather) => {
  const startIdx = MONTHS.indexOf(startMonth);
  if (startIdx === -1) return false;

  let monthsNeeded = Math.ceil(crop.growthPeriod.total);
  let drySeasonMonths = 0;
  let earlyGrowthDryMonths = 0;
  let consecutiveDryMonths = 0;
  let maxConsecutiveDry = 0;
  let lateHarvestDry = false;
  
  for (let m = 0; m < monthsNeeded; m++) {
    const monthIndex = (startIdx + m) % 12;
    const monthWeather = cityWeather[monthIndex];
    const season = determineSeason(monthWeather.month);
    
    let currentPhaseTime = 0;
    let currentPhase = null;
    
    for (const phase of crop.growthPeriod.phases) {
      if (currentPhaseTime <= m && m < currentPhaseTime + phase.duration) {
        currentPhase = phase;
        break;
      }
      currentPhaseTime += phase.duration;
    }

    if (!currentPhase) {
      console.warn(`Tidak dapat menentukan fase untuk bulan ke-${m}`);
      currentPhase = { waterNeed: 'medium' };
    }

    const isEarlyToMidGrowth = m < 7;  // 7 bulan pertama butuh air
    const isLateHarvest = m >= 7;      // 2 bulan terakhir boleh kering

    if (season === 'Kemarau') {
      drySeasonMonths++;
      consecutiveDryMonths++;
      maxConsecutiveDry = Math.max(maxConsecutiveDry, consecutiveDryMonths);
      
      if (crop.name === 'Singkong') {
        if (isLateHarvest) {
          lateHarvestDry = true;  // Bagus untuk panen
        } else if (isEarlyToMidGrowth) {
          // Hitung kekeringan di 7 bulan pertama
          if (monthWeather.rainfall < 60) {  // Sedikit lebih toleran
            earlyGrowthDryMonths++;
          }
        }
      } else {
        // Logika untuk tanaman lain tetap sama
        if (currentPhase.waterNeed === 'high') {
          earlyGrowthDryMonths++;
        } else if (currentPhase.waterNeed === 'medium' && monthWeather.rainfall < 100) {
          earlyGrowthDryMonths++;
        }
      }
    } else {
      consecutiveDryMonths = 0;
    }
  }

  // Khusus untuk singkong
  if (crop.name === 'Singkong') {
    // Kriteria:
    // 1. 7 bulan pertama harus cukup air (earlyGrowthDryMonths harus minimal)
    // 2. 2 bulan terakhir sebaiknya kering (lateHarvestDry = true)
    // 3. Tidak boleh kering berturut-turut terlalu lama di awal-tengah
    return earlyGrowthDryMonths <= 1 && // Toleransi maksimal 1 bulan kering di awal-tengah
           maxConsecutiveDry <= 3 &&     // Maksimal 3 bulan kering berturut-turut
           lateHarvestDry;               // Harus kering di akhir
  } else if (crop.growthPeriod.total > 6) {
    return earlyGrowthDryMonths === 0 && maxConsecutiveDry <= 2;
  } else {
    return earlyGrowthDryMonths === 0 && drySeasonMonths === 0;
  }
};

const isOptimalPlantingMonth = (month, cropType, cityWeather) => {
  const crop = CROPS.find(c => c.name === cropType);
  if (!crop) return 'Tidak Optimal';

  const monthIdx = MONTHS.indexOf(month);
  const nextMonth = MONTHS[(monthIdx + 1) % 12];
  const currentSeason = determineSeason(month);
  const nextSeason = determineSeason(nextMonth);
  
  // Cek apakah ini periode transisi kemarau ke hujan
  const isTransitionToWet = currentSeason === 'Kemarau' && nextSeason === 'Hujan';
  const isRecommendedMonth = crop.bestPlantingMonths.includes(month);
  const isSuitableGrowthPeriod = checkGrowthPeriodSuitability(month, crop, cityWeather);

  if (crop.name === 'Singkong') {
    if (isTransitionToWet && isSuitableGrowthPeriod) {
      return 'Sangat Optimal';  // Prioritaskan masa transisi
    } else if (isSuitableGrowthPeriod) {
      return isRecommendedMonth ? 'Sangat Optimal' : 'Cukup Optimal';
    }
  } else {
    if (isRecommendedMonth && isSuitableGrowthPeriod) {
      return 'Sangat Optimal';
    } else if (isSuitableGrowthPeriod) {
      return 'Cukup Optimal';
    }
  }
  
  return 'Tidak Optimal';
};

Object.keys(CITIES).forEach(city => {
    CITIES[city].monthlyWeather = CITIES[city].monthlyWeather.map(weather => ({
        ...weather,
        season: determineSeason(weather.month),
        plantingInfo: isOptimalPlantingMonth(weather.month, 'Padi', CITIES[city].monthlyWeather)
    }));
});

// Fungsi untuk menentukan musim
const determinePlantingSeason = (month, avgTemperature, avgRainfall) => {
    // Define optimal conditions for each planting season
    const conditions = {
        'MT1': { tempRange: [20, 30], rainfallRange: [100, 200] },
        'MT2': { tempRange: [25, 35], rainfallRange: [150, 250] },
        'MT3': { tempRange: [22, 32], rainfallRange: [120, 220] }
    };

    // Determine the planting season based on climate data
    for (const [season, { tempRange, rainfallRange }] of Object.entries(conditions)) {
        if (
            avgTemperature >= tempRange[0] && avgTemperature <= tempRange[1] &&
            avgRainfall >= rainfallRange[0] && avgRainfall <= rainfallRange[1]
        ) {
            return season;
        }
    }
    return 'Tidak Diketahui';
};

const isOptimalForAnyCrop = (month) => {
    return CROPS.some(crop => crop.bestPlantingMonths.includes(month)) ? 'Optimal' : 'Tidak Optimal';
};

// Fungsi untuk memanggil Gemini AI
async function getGeminiAnalysis(prompt, month, cropType) {
  try {
    const refinedPrompt = `${prompt} Please analyze the planting suitability for ${cropType} in the month of ${month}. Consider the average temperature and rainfall.`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: refinedPrompt
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Maaf, terjadi kesalahan saat menganalisis dengan AI. Silakan coba lagi dalam beberapa saat.";
  }
}

// Komponen WeatherCharts untuk visualisasi data cuaca
const WeatherCharts = () => {
  const [city, setCity] = React.useState("Jambi");
  const [selectedCrop, setSelectedCrop] = React.useState('Padi');
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysis, setAnalysis] = React.useState('');
  const [aiAnalysis, setAiAnalysis] = React.useState('');
  const [analysisProgress, setAnalysisProgress] = React.useState(0);
  const chartRef = React.useRef(null);
  const rainChartRef = React.useRef(null);
  const [charts, setCharts] = React.useState({ temp: null, rain: null });
  const [weatherData, setWeatherData] = React.useState([]); // Declare weatherData state

  // Update weather data when city or crop changes
  React.useEffect(() => {
    const updatedWeatherData = CITIES[city].monthlyWeather.map(weather => ({
      ...weather,
      season: determineSeason(weather.month),
      plantingInfo: isOptimalPlantingMonth(weather.month, selectedCrop, CITIES[city].monthlyWeather)
    }));
    setWeatherData(updatedWeatherData);
  }, [city, selectedCrop]);

  React.useEffect(() => {
    if (!weatherData.length || !chartRef.current || !rainChartRef.current) return;

    // Destroy existing charts
    if (charts.temp) charts.temp.destroy();
    if (charts.rain) charts.rain.destroy();

    // Temperature Chart
    const tempCtx = chartRef.current.getContext('2d');
    const tempChart = new Chart(tempCtx, {
      type: 'line',
      data: {
        labels: weatherData.map(w => w.month),
        datasets: [
          {
            label: 'Suhu Maksimum (°C)',
            data: weatherData.map(w => w.temperature_max),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Suhu Minimum (°C)',
            data: weatherData.map(w => w.temperature_min),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    // Rainfall Chart
    const rainCtx = rainChartRef.current.getContext('2d');
    const rainChart = new Chart(rainCtx, {
      type: 'bar',
      data: {
        labels: weatherData.map(w => w.month),
        datasets: [{
          label: 'Curah Hujan (mm)',
          data: weatherData.map(w => w.rainfall),
          backgroundColor: COLORS.accent,
          borderColor: COLORS.accent,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    setCharts({ temp: tempChart, rain: rainChart });

    return () => {
      if (charts.temp) charts.temp.destroy();
      if (charts.rain) charts.rain.destroy();
    };
  }, [weatherData]);

  const analyzeWeather = async () => {
    setAnalyzing(true);
    setAnalysisProgress(0);
    
    try {
      const progressPromise = new Promise(resolve => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setAnalysisProgress(progress);
          if (progress >= 90) {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });

      const crop = CROPS.find(c => c.name === selectedCrop);
      const cityData = weatherData;
      
      // Format data for analysis
      const annualData = cityData.map(weather => `
${weather.month}:
- Suhu: ${weather.temperature_min}°C - ${weather.temperature_max}°C
- Curah Hujan: ${weather.rainfall} mm
- Musim: ${weather.season}
- Kelayakan Tanam: ${weather.plantingInfo}
`).join('\n');

      // Generate analysis text
      setAnalysis(`Analisis Iklim untuk ${selectedCrop} di ${city}:

1. Informasi Tanaman
   - Masa Pertumbuhan Total: ${crop.growthPeriod.total} bulan
   - Fase Pertumbuhan:
     ${crop.growthPeriod.phases.map(phase => 
       `* ${phase.name} (${phase.duration} bulan) - Kebutuhan Air: ${phase.waterNeed === 'high' ? 'Tinggi' : phase.waterNeed === 'medium' ? 'Sedang' : 'Rendah'}`
     ).join('\n     ')}

2. Suhu
   - Rentang optimal: ${crop.optimalTemperature.min}°C - ${crop.optimalTemperature.max}°C
   - Kondisi aktual: ${Math.min(...cityData.map(w => w.temperature_min))}°C - ${Math.max(...cityData.map(w => w.temperature_max))}°C

3. Curah Hujan
   - Kebutuhan air: ${crop.waterRequirement.min} - ${crop.waterRequirement.max} mm/bulan
   - Rata-rata aktual: ${(cityData.reduce((sum, w) => sum + w.rainfall, 0) / 12).toFixed(1)} mm/bulan

4. Musim Tanam
   - Bulan sangat optimal: ${cityData.filter(w => w.plantingInfo === 'Sangat Optimal').map(w => w.month).join(', ')}
   - Bulan cukup optimal: ${cityData.filter(w => w.plantingInfo === 'Cukup Optimal').map(w => w.month).join(', ')}
   - Musim dominan: ${cityData[0].season}

5. Pertimbangan Khusus:
   - Jenis Tanah: ${crop.soilType}
   - Tantangan: ${crop.challenges}

Data Iklim Tahunan:
${annualData}
`);

      const aiPrompt = `Analisis data iklim berikut untuk budidaya ${selectedCrop} di ${city}:

Data Tanaman:
- Masa Pertumbuhan: ${crop.growthPeriod.total} bulan
- Fase Pertumbuhan:
${crop.growthPeriod.phases.map(phase => 
  `  * ${phase.name} (${phase.duration} bulan) - Kebutuhan Air: ${phase.waterNeed}`
).join('\n')}
- Suhu Optimal: ${crop.optimalTemperature.min}°C - ${crop.optimalTemperature.max}°C
- Kebutuhan Air: ${crop.waterRequirement.min} - ${crop.waterRequirement.max} mm/bulan
- Jenis Tanah Terbaik: ${crop.soilType}
- Bulan Terbaik Tanam: ${crop.bestPlantingMonths.join(', ')}
- Tantangan Utama: ${crop.challenges}

Data Iklim Tahunan:
${annualData}

Berikan analisis mendalam tentang:
1. Kesesuaian kondisi iklim untuk setiap fase pertumbuhan tanaman
2. Rekomendasi waktu tanam yang optimal berdasarkan kebutuhan air tiap fase
3. Potensi risiko dan cara mitigasinya
4. Teknik budidaya yang sesuai dengan kondisi iklim
5. Antisipasi perubahan cuaca selama masa pertumbuhan
`;

      const aiResult = await getGeminiAnalysis(aiPrompt, cityData[0].month, selectedCrop);
      setAiAnalysis(aiResult);
      setAnalysisProgress(100);
      
      await progressPromise;
    } catch (error) {
      console.error("Error in analysis:", error);
      setAiAnalysis(`Maaf, terjadi kesalahan saat menganalisis: ${error.message}`);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(100);
    }
  };

  const styles = {
    tableHeaderStyle: {
      padding: '12px',
      textAlign: 'left',
      backgroundColor: COLORS.light,
      color: COLORS.dark,
      fontWeight: '600',
      borderBottom: `2px solid ${COLORS.primary}`
    },
    tableCellStyle: {
      padding: '12px',
      borderBottom: `1px solid ${COLORS.light}`,
      color: COLORS.gray
    }
  };

  return (
    <div className="tab-content">
      <div className="input-group" style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={analyzing}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}
        >
          {Object.keys(CITIES).map(cityName => (
            <option key={cityName} value={cityName}>{cityName}</option>
          ))}
        </select>
        
        <select
          value={selectedCrop}
          onChange={(e) => setSelectedCrop(e.target.value)}
          disabled={analyzing}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}
        >
          {CROPS.map(crop => (
            <option key={crop.name} value={crop.name}>{crop.name}</option>
          ))}
        </select>
        
        <button
          onClick={analyzeWeather}
          disabled={analyzing}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: analyzing ? '#a0aec0' : COLORS.primary,
            color: 'white',
            cursor: analyzing ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {analyzing ? 'Menganalisis...' : 'Analisa Musim Tanam'}
        </button>
      </div>

      <div className="charts-container" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: `1px solid ${COLORS.light}`
        }}>
          <canvas ref={chartRef}></canvas>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: `1px solid ${COLORS.light}`
        }}>
          <canvas ref={rainChartRef}></canvas>
        </div>
      </div>

      <div className="weather-table" style={{
        marginTop: '20px',
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={styles.tableHeaderStyle}>Bulan</th>
              <th style={styles.tableHeaderStyle}>Suhu Min (°C)</th>
              <th style={styles.tableHeaderStyle}>Suhu Max (°C)</th>
              <th style={styles.tableHeaderStyle}>Curah Hujan (mm)</th>
              <th style={styles.tableHeaderStyle}>Musim</th>
              <th style={styles.tableHeaderStyle}>Kelayakan Tanam</th>
            </tr>
          </thead>
          <tbody>
            {weatherData.map((weather, index) => (
              <tr key={index}>
                <td style={styles.tableCellStyle}>{weather.month}</td>
                <td style={styles.tableCellStyle}>{weather.temperature_min}</td>
                <td style={styles.tableCellStyle}>{weather.temperature_max}</td>
                <td style={styles.tableCellStyle}>{weather.rainfall}</td>
                <td style={styles.tableCellStyle}>{weather.season}</td>
                <td style={styles.tableCellStyle}>{weather.plantingInfo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analysis && (
        <div className="analysis-result" style={{
          marginTop: '20px',
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit'
          }}>
            {analysis}
          </pre>
          <div className="ai-analysis">
            <h3 style={{
              marginTop: '20px',
              color: COLORS.dark
            }}>
              Analisis AI:
            </h3>
            {analyzing ? (
              <div className="loading-spinner">
                <progress 
                  value={analysisProgress} 
                  max={100}
                  style={{
                    width: '100%',
                    height: '8px'
                  }}
                />
                <div>Menganalisis dengan AI...</div>
              </div>
            ) : (
              <div 
                className="ai-content"
                dangerouslySetInnerHTML={{
                  __html: aiAnalysis
                    ? aiAnalysis
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\n/g, "<br>")
                    : ""
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Komponen FarmingAnalysis untuk analisis usaha tani
const FarmingAnalysis = () => {
    const [formData, setFormData] = React.useState({
        landSize: '',
        landUnit: 'hectare',
        soilType: '',
        irrigationType: '',
        soilPh: '',
        landSlope: '',
        landHistory: '',
        waterSource: '',
        landStatus: '',
        landAddress: '',
        cropType: '',
        cropVariety: '',
        plantingMethod: '',
        cropAge: '',
        plantingDistance: '',
        seedsPerHole: '',
        fertilizer: '',
        pesticide: '',
        weedControl: '',
        harvestMethod: '',
        laborCount: '',
        seedCost: '',
        fertilizerCost: '',
        pesticideCost: '',
        laborCost: '',
        equipmentCost: '',
        otherCosts: '',
        expectedYield: '',
        marketPrice: '',
        marketLocation: '',
        buyerType: '',
        grainQuality: '',
        marketingStrategy: '',
        farmingExperience: '',
        previousCrop: '',
        farmingGroup: '',
        technicalAssistance: '',
        insuranceStatus: '',
        certifications: ''
    });

    const sampleData = {
        // Data Lahan
        landSize: "1000",
        landUnit: "m2",
        soilType: "Tanah Humus",
        irrigationType: "Irigasi Teknis",
        soilPh: "6.5",
        landSlope: "Datar (0-3%)",
        landHistory: "Lahan bekas sawah produktif",
        waterSource: "Sungai dan sumur",
        landStatus: "Milik Sendiri",
        landAddress: "Desa Sumber Makmur, Kec. Tani Jaya",
        
        // Data Tanaman
        cropType: "Padi",
        cropVariety: "IR64",
        plantingMethod: "Tanam Pindah (Tandur)",
        cropAge: "110-120 hari",
        plantingDistance: "25 x 25 cm",
        seedsPerHole: "2-3 bibit",
        fertilizer: "NPK Phonska (300 kg/ha), Urea (200 kg/ha)",
        pesticide: "Pestisida organik berbahan daun nimba",
        weedControl: "Penyiangan manual dan herbisida selektif",
        harvestMethod: "Combine Harvester",

        // Biaya Produksi
        seedCost: "500000",
        fertilizerCost: "1500000",
        pesticideCost: "500000",
        laborCount: "3",
        laborCost: "3000000",
        equipmentCost: "2000000",
        otherCosts: "1000000",

        // Proyeksi Produksi & Pendapatan
        expectedYield: "4000",
        marketPrice: "5000",
        marketLocation: "Pasar Induk Daerah",
        buyerType: "Pengepul dan Bulog",
        grainQuality: "Premium (Kadar air 14%)",
        marketingStrategy: "Kemitraan dengan Bulog",

        // Info Tambahan
        farmingExperience: "5",
        previousCrop: "Jagung",
        farmingGroup: "Kelompok Tani Makmur Jaya",
        technicalAssistance: "Penyuluh Pertanian Lapangan (PPL)",
        insuranceStatus: "AUTP (Asuransi Usaha Tani Padi)",
        certifications: "Sertifikasi GAP (Good Agricultural Practices)"
    };

    const loadSampleData = () => {
        setFormData(sampleData);
    };

    const [isLoading, setIsLoading] = React.useState(false);
    const [analysis, setAnalysis] = React.useState(null);
    const [error, setError] = React.useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const generateAnalysis = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const prompt = `Berdasarkan data usaha tani berikut:

Lahan: ${formData.landSize} ${formData.landUnit}
Biaya Operasional: Rp ${calculateTotalCosts().toLocaleString()}
Estimasi Hasil Panen: ${formData.expectedYield} kg
Harga Jual: Rp ${formData.marketPrice}/kg
ROI: ${calculateROI().toFixed(1)}%
B/C Ratio: ${calculateBCRatio().toFixed(2)}
Break Even Point: ${calculateBEP().units.toFixed(0)} kg

Berikan analisis komprehensif dalam bentuk satu paragraf yang detail dan mendalam. Gunakan format teks berikut:
- Gunakan **teks** untuk penekanan penting atau kesimpulan utama
- Gunakan *teks* untuk istilah teknis, angka-angka kunci, atau nilai penting
- Gunakan __teks__ untuk rekomendasi atau saran penting

Analisis harus mencakup aspek-aspek berikut dalam satu paragraf yang mengalir:
1. Evaluasi kelayakan finansial (ROI, B/C Ratio, BEP)
2. Analisis potensi keuntungan dan risiko
3. Rekomendasi strategi optimasi dan mitigasi risiko
4. Prospek keberlanjutan usaha
5. Aspek teknis dan operasional yang relevan
6. Strategi pemasaran dan pengembangan usaha
7. Perbandingan dengan standar industri pertanian
8. Faktor-faktor kritis kesuksesan

Gunakan bahasa formal dan ilmiah yang mengalir dengan baik. Hindari penggunaan poin-poin atau pembagian yang terpisah. Semua aspek harus terhubung secara logis dalam satu paragraf yang kohesif dan komprehensif.`;

            const result = await getGeminiAnalysis(prompt, formData.landAddress, formData.cropType);
            setAnalysis(result);
        } catch (error) {
            setError("Terjadi kesalahan saat menganalisis data. Silakan coba lagi.");
            console.error("Error generating analysis:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fungsi perhitungan finansial
    const calculateTotalCosts = () => {
        const seedCost = parseInt(formData.seedCost) || 0;
        const fertilizerCost = parseInt(formData.fertilizerCost) || 0;
        const pesticideCost = parseInt(formData.pesticideCost) || 0;
        const laborCost = parseInt(formData.laborCost) || 0;
        const equipmentCost = parseInt(formData.equipmentCost) || 0;
        const otherCosts = parseInt(formData.otherCosts) || 0;
        
        return seedCost + fertilizerCost + pesticideCost + laborCost + equipmentCost + otherCosts;
    };

    const calculateEstimatedRevenue = () => {
        const yield_kg = parseInt(formData.expectedYield) || 0;
        const price_per_kg = parseInt(formData.marketPrice) || 0;
        return yield_kg * price_per_kg;
    };

    const calculateBEP = () => {
        const totalCosts = calculateTotalCosts();
        const pricePerKg = parseInt(formData.marketPrice) || 0;
        
        if (pricePerKg === 0) return { units: 0, value: 0 };
        
        const bepUnits = totalCosts / pricePerKg; // BEP dalam kg
        const bepValue = totalCosts; // BEP dalam Rupiah
        
        return { units: bepUnits, value: bepValue };
    };

    const calculateBCRatio = () => {
        const totalCosts = calculateTotalCosts();
        const totalRevenue = calculateEstimatedRevenue();
        
        if (totalCosts === 0) return 0;
        return totalRevenue / totalCosts;
    };

    const calculateROI = () => {
        const totalCosts = calculateTotalCosts();
        const totalRevenue = calculateEstimatedRevenue();
        const profit = totalRevenue - totalCosts;
        
        if (totalCosts === 0) return 0;
        return (profit / totalCosts) * 100;
    };

    const analyzeLandSuitability = () => {
        const crop = CROPS.find(c => c.name.toLowerCase() === formData.cropType.toLowerCase());
        if (!crop) return { suitable: false, message: 'Jenis tanaman tidak ditemukan dalam database' };

        const soilTypeMatch = formData.soilType.toLowerCase().includes(crop.soilType.toLowerCase());
        const phValue = parseFloat(formData.soilPh);
        const phSuitable = phValue >= 5.5 && phValue <= 7.5;

        return {
            suitable: soilTypeMatch && phSuitable,
            message: `${soilTypeMatch ? '✓' : '✗'} Jenis Tanah\n${phSuitable ? '✓' : '✗'} pH Tanah`,
            recommendations: crop.challenges
        };
    };

    const analyzePlantingSeason = (cityData) => {
        const crop = CROPS.find(c => c.name.toLowerCase() === formData.cropType.toLowerCase());
        if (!crop) return { suitable: false, message: 'Jenis tanaman tidak ditemukan' };

        const currentMonth = new Date().getMonth();
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const currentMonthName = monthNames[currentMonth];

        const isOptimalMonth = crop.bestPlantingMonths.includes(currentMonthName);
        const weatherData = cityData?.monthlyWeather[currentMonth];

        if (!weatherData) return { suitable: false, message: 'Data cuaca tidak tersedia' };

        const tempSuitable = weatherData.temperature_max <= crop.optimalTemperature.max && 
                           weatherData.temperature_min >= crop.optimalTemperature.min;
        
        const waterSuitable = weatherData.rainfall >= crop.waterRequirement.min && 
                            weatherData.rainfall <= crop.waterRequirement.max;

        return {
            suitable: isOptimalMonth && tempSuitable && waterSuitable,
            message: `
                ${isOptimalMonth ? '✓' : '✗'} Bulan Tanam Optimal
                ${tempSuitable ? '✓' : '✗'} Suhu Sesuai (${weatherData.temperature_min}°C - ${weatherData.temperature_max}°C)
                ${waterSuitable ? '✓' : '✗'} Curah Hujan Sesuai (${weatherData.rainfall} mm/bulan)
            `,
            recommendations: weatherData.season === "Hujan" ? 
                "Perhatikan drainase dan antisipasi serangan penyakit" : 
                "Pastikan ketersediaan air irigasi dan antisipasi kekeringan"
        };
    };

    // Fungsi untuk memformat teks analisis menjadi satu paragraf
    function formatAnalysisText(text) {
        if (!text) return '';

        // Format teks dengan markdown-style formatting
        let formattedText = text
            // Format bold text
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            // Format italic text
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            // Format underlined text
            .replace(/__(.*?)__/g, "<u>$1</u>")
            // Format numbers and currency
            .replace(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, '<span class="number">$1</span>')
            .replace(/(Rp\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g, '<span class="currency">$1</span>');

        // Membersihkan teks dan membuat satu paragraf
        formattedText = formattedText
            .split(/\n+/) // Membagi berdasarkan newlines
            .map(line => line.trim()) // Membersihkan whitespace
            .filter(line => line && !line.startsWith('-')) // Menghapus baris kosong dan bullet points
            .join(' '); // Menggabungkan menjadi satu paragraf

        return `<p class="analysis-paragraph">${formattedText}</p>`;
    }

    const defaultAnalysisText = `1. ANALISIS KELAYAKAN USAHA
- Silakan masukkan data usaha tani Anda untuk mendapatkan **analisis kelayakan** yang akurat
- Kami akan membandingkan dengan *standar industri pertanian*
- Anda akan mendapatkan __rekomendasi spesifik__ untuk usaha tani Anda

2. ANALISIS KEUANGAN
- Perhitungan Break Even Point (BEP)
- Analisis margin keuntungan
- Rasio biaya-pendapatan
- Proyeksi arus kas

3. ANALISIS TEKNIS
- Evaluasi kesesuaian lahan dan tanaman
- Analisis efisiensi penggunaan input
- Rekomendasi peningkatan produktivitas

4. ANALISIS RISIKO
- Identifikasi potensi risiko
- Strategi mitigasi
- Rekomendasi asuransi

5. STRATEGI PENGEMBANGAN
- Saran peningkatan efisiensi
- Peluang diversifikasi
- Strategi pemasaran
- Analisis nilai tambah

__Masukkan data usaha tani Anda untuk mendapatkan analisis yang lebih akurat dan spesifik.__`;

    // Default values for basic analysis
    const defaultAnalysis = {
        modalUsaha: 10000000,
        proyeksiPendapatan: 15000000,
        estimasiKeuntungan: 5000000,
        roi: 50,
        hasilPanen: 1000,
        hargaJual: 15000
    };

    React.useEffect(() => {
        setFormData(sampleData);
    }, []);

    return (
        <div className="farming-analysis">
            <div className="form-container">
                <div className="form-section">
                    <div className="section-header">
                        <h3>Data Lahan</h3>
                    </div>

                    <div className="form-group">
                        <label>Luas Lahan</label>
                        <div className="input-group">
                            <input
                                type="number"
                                name="landSize"
                                value={formData.landSize}
                                onChange={handleInputChange}
                                placeholder="Masukkan luas lahan"
                            />
                            <select 
                                name="landUnit"
                                value={formData.landUnit}
                                onChange={handleInputChange}
                            >
                                <option value="m2">m²</option>
                                <option value="ha">ha</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Jenis Tanah</label>
                        <input
                            type="text"
                            name="soilType"
                            value={formData.soilType}
                            onChange={handleInputChange}
                            placeholder="Contoh: Tanah Humus, Tanah Liat"
                        />
                    </div>

                    <div className="form-group">
                        <label>Sistem Irigasi</label>
                        <input
                            type="text"
                            name="irrigationType"
                            value={formData.irrigationType}
                            onChange={handleInputChange}
                            placeholder="Contoh: Irigasi Teknis, Tadah Hujan"
                        />
                    </div>

                    <div className="form-fields">
                        <div className="form-group">
                            <label>pH Tanah</label>
                            <input
                                type="text"
                                name="soilPh"
                                value={formData.soilPh}
                                onChange={handleInputChange}
                                placeholder="Contoh: 6.5"
                            />
                        </div>

                        <div className="form-group">
                            <label>Kemiringan Lahan</label>
                            <input
                                type="text"
                                name="landSlope"
                                value={formData.landSlope}
                                onChange={handleInputChange}
                                placeholder="Contoh: Datar (0-3%)"
                            />
                        </div>

                        <div className="form-group">
                            <label>Riwayat Lahan</label>
                            <input
                                type="text"
                                name="landHistory"
                                value={formData.landHistory}
                                onChange={handleInputChange}
                                placeholder="Contoh: Bekas sawah produktif"
                            />
                        </div>

                        <div className="form-group">
                            <label>Sumber Air</label>
                            <input
                                type="text"
                                name="waterSource"
                                value={formData.waterSource}
                                onChange={handleInputChange}
                                placeholder="Contoh: Sungai, Sumur"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Data Tanaman</h3>
                    <div className="form-group">
                        <label>Jenis Tanaman</label>
                        <input
                            type="text"
                            name="cropType"
                            value={formData.cropType}
                            onChange={handleInputChange}
                            placeholder="Contoh: Padi"
                        />
                    </div>

                    <div className="form-group">
                        <label>Pupuk</label>
                        <input
                            type="text"
                            name="fertilizer"
                            value={formData.fertilizer}
                            onChange={handleInputChange}
                            placeholder="Jenis dan dosis pupuk"
                        />
                    </div>

                    <div className="form-group">
                        <label>Pestisida</label>
                        <input
                            type="text"
                            name="pesticide"
                            value={formData.pesticide}
                            onChange={handleInputChange}
                            placeholder="Jenis pestisida yang digunakan"
                        />
                    </div>

                    <div className="form-fields">
                        <div className="form-group">
                            <label>Varietas</label>
                            <input
                                type="text"
                                name="cropVariety"
                                value={formData.cropVariety}
                                onChange={handleInputChange}
                                placeholder="Contoh: IR64, Ciherang"
                            />
                        </div>

                        <div className="form-group">
                            <label>Metode Tanam</label>
                            <input
                                type="text"
                                name="plantingMethod"
                                value={formData.plantingMethod}
                                onChange={handleInputChange}
                                placeholder="Contoh: Tanam Pindah"
                            />
                        </div>

                        <div className="form-group">
                            <label>Umur Panen</label>
                            <input
                                type="text"
                                name="cropAge"
                                value={formData.cropAge}
                                onChange={handleInputChange}
                                placeholder="Contoh: 110-120 hari"
                            />
                        </div>

                        <div className="form-group">
                            <label>Jarak Tanam</label>
                            <input
                                type="text"
                                name="plantingDistance"
                                value={formData.plantingDistance}
                                onChange={handleInputChange}
                                placeholder="Contoh: 25 x 25 cm"
                            />
                        </div>

                        <div className="form-group">
                            <label>Pengendalian Gulma</label>
                            <input
                                type="text"
                                name="weedControl"
                                value={formData.weedControl}
                                onChange={handleInputChange}
                                placeholder="Contoh: Manual dan herbisida"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Data Biaya</h3>
                    <div className="form-group">
                        <label>Biaya Benih (Rp)</label>
                        <input
                            type="number"
                            name="seedCost"
                            value={formData.seedCost}
                            onChange={handleInputChange}
                            placeholder="Masukkan biaya benih"
                        />
                    </div>
                    <div className="form-group">
                        <label>Biaya Pupuk (Rp)</label>
                        <input
                            type="number"
                            name="fertilizerCost"
                            value={formData.fertilizerCost}
                            onChange={handleInputChange}
                            placeholder="Masukkan biaya pupuk"
                        />
                    </div>
                    <div className="form-group">
                        <label>Biaya Pestisida (Rp)</label>
                        <input
                            type="number"
                            name="pesticideCost"
                            value={formData.pesticideCost}
                            onChange={handleInputChange}
                            placeholder="Masukkan biaya pestisida"
                        />
                    </div>
                    <div className="form-group">
                        <label>Jumlah Pekerja</label>
                        <input
                            type="number"
                            name="laborCount"
                            value={formData.laborCount}
                            onChange={handleInputChange}
                            placeholder="Masukkan jumlah pekerja"
                        />
                    </div>
                    <div className="form-group">
                        <label>Biaya Tenaga Kerja (Rp)</label>
                        <input
                            type="number"
                            name="laborCost"
                            value={formData.laborCost}
                            onChange={handleInputChange}
                            placeholder="Masukkan biaya tenaga kerja"
                        />
                    </div>
                    <div className="form-group">
                        <label>Biaya Peralatan (Rp)</label>
                        <input
                            type="number"
                            name="equipmentCost"
                            value={formData.equipmentCost}
                            onChange={handleInputChange}
                            placeholder="Masukkan biaya peralatan"
                        />
                    </div>
                    <div className="form-group">
                        <label>Biaya Lainnya (Rp)</label>
                        <input
                            type="number"
                            name="otherCosts"
                            value={formData.otherCosts}
                            onChange={handleInputChange}
                            placeholder="Masukkan biaya lainnya"
                        />
                    </div>
                </div>

                <div className="form-section">
                    <h3>Data Produksi & Pemasaran</h3>
                    <div className="form-group">
                        <label>Perkiraan Hasil Panen (kg)</label>
                        <input
                            type="number"
                            name="expectedYield"
                            value={formData.expectedYield}
                            onChange={handleInputChange}
                            placeholder="Masukkan perkiraan hasil panen"
                        />
                    </div>
                    <div className="form-group">
                        <label>Harga Pasar (Rp/kg)</label>
                        <input
                            type="number"
                            name="marketPrice"
                            value={formData.marketPrice}
                            onChange={handleInputChange}
                            placeholder="Masukkan harga pasar per kg"
                        />
                    </div>
                    <div className="form-group">
                        <label>Lokasi Pemasaran</label>
                        <input
                            type="text"
                            name="marketLocation"
                            value={formData.marketLocation}
                            onChange={handleInputChange}
                            placeholder="Masukkan lokasi pemasaran"
                        />
                    </div>
                    <div className="form-group">
                        <label>Jenis Pembeli</label>
                        <input
                            type="text"
                            name="buyerType"
                            value={formData.buyerType}
                            onChange={handleInputChange}
                            placeholder="Contoh: Pengepul, Bulog"
                        />
                    </div>
                    <div className="form-group">
                        <label>Kualitas Gabah</label>
                        <input
                            type="text"
                            name="grainQuality"
                            value={formData.grainQuality}
                            onChange={handleInputChange}
                            placeholder="Contoh: Premium (Kadar air 14%)"
                        />
                    </div>
                    <div className="form-group">
                        <label>Strategi Pemasaran</label>
                        <input
                            type="text"
                            name="marketingStrategy"
                            value={formData.marketingStrategy}
                            onChange={handleInputChange}
                            placeholder="Contoh: Kemitraan dengan Bulog"
                        />
                    </div>
                </div>

                <div className="form-section">
                    <h3>Data Tambahan</h3>
                    <div className="form-group">
                        <label>Pengalaman Bertani (tahun)</label>
                        <input
                            type="number"
                            name="farmingExperience"
                            value={formData.farmingExperience}
                            onChange={handleInputChange}
                            placeholder="Masukkan pengalaman bertani"
                        />
                    </div>
                    <div className="form-group">
                        <label>Tanaman Sebelumnya</label>
                        <input
                            type="text"
                            name="previousCrop"
                            value={formData.previousCrop}
                            onChange={handleInputChange}
                            placeholder="Masukkan jenis tanaman sebelumnya"
                        />
                    </div>
                    <div className="form-group">
                        <label>Kelompok Tani</label>
                        <input
                            type="text"
                            name="farmingGroup"
                            value={formData.farmingGroup}
                            onChange={handleInputChange}
                            placeholder="Contoh: Kelompok Tani Makmur Jaya"
                        />
                    </div>
                    <div className="form-group">
                        <label>Bantuan Teknis</label>
                        <input
                            type="text"
                            name="technicalAssistance"
                            value={formData.technicalAssistance}
                            onChange={handleInputChange}
                            placeholder="Contoh: Penyuluh Pertanian Lapangan (PPL)"
                        />
                    </div>
                    <div className="form-group">
                        <label>Status Asuransi</label>
                        <input
                            type="text"
                            name="insuranceStatus"
                            value={formData.insuranceStatus}
                            onChange={handleInputChange}
                            placeholder="Contoh: AUTP (Asuransi Usaha Tani Padi)"
                        />
                    </div>
                    <div className="form-group">
                        <label>Sertifikasi</label>
                        <input
                            type="text"
                            name="certifications"
                            value={formData.certifications}
                            onChange={handleInputChange}
                            placeholder="Contoh: Sertifikasi GAP (Good Agricultural Practices)"
                        />
                    </div>
                </div>
            </div>

            <button 
                className="analyze-button"
                onClick={generateAnalysis}
                disabled={isLoading}
            >
                {isLoading ? 'Menganalisis...' : 'Analisis Usaha Tani'}
            </button>

            {isLoading && (
                <div className="loading-spinner">
                    <progress 
                      value={undefined} 
                      max={100}
                      style={{
                        width: '100%',
                        height: '8px'
                      }}
                    />
                    <div>Sedang menganalisis data usaha tani...</div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="analysis-container">
                <div className="analysis-result basic">
                    <h3>
                        <i className="fas fa-calculator"></i>
                        Analisis Dasar Usaha Tani
                    </h3>
                    {!analysis ? (
                        <div className="empty-state">
                            <i className="fas fa-chart-line"></i>
                            <p>Masukkan data usaha tani Anda dan klik tombol Analisis untuk melihat hasil perhitungan dasar.</p>
                        </div>
                    ) : (
                        <div className="basic-analysis">
                            <div className="analysis-card">
                                <h4>Modal Usaha</h4>
                                <p>Rp {calculateTotalCosts().toLocaleString()}</p>
                                <div className="label">Total biaya operasional</div>
                            </div>
                            <div className="analysis-card">
                                <h4>Proyeksi Pendapatan</h4>
                                <p>Rp {calculateEstimatedRevenue().toLocaleString()}</p>
                                <div className="label">Berdasarkan estimasi hasil panen</div>
                            </div>
                            <div className="analysis-card">
                                <h4>Estimasi Keuntungan</h4>
                                <p>Rp {(calculateEstimatedRevenue() - calculateTotalCosts()).toLocaleString()}</p>
                                <div className="label">Pendapatan - Modal</div>
                            </div>
                            <div className="analysis-card">
                                <h4>ROI</h4>
                                <p>{calculateROI().toFixed(1)}%</p>
                                <div className="label">Return on Investment</div>
                            </div>
                            <div className="analysis-card">
                                <h4>Break Even Point</h4>
                                <p>{calculateBEP().units.toFixed(0)} kg</p>
                                <div className="label">Titik impas produksi</div>
                            </div>
                            <div className="analysis-card">
                                <h4>B/C Ratio</h4>
                                <p>{calculateBCRatio().toFixed(2)}</p>
                                <div className="label">Rasio manfaat-biaya</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="analysis-result ai">
                    <h3>
                        <i className="fas fa-brain"></i>
                        Pembahasan AI
                    </h3>
                    {!analysis ? (
                        <div className="empty-state">
                            <i className="fas fa-robot"></i>
                            <p>Hasil analisis AI akan muncul di sini setelah Anda mengklik tombol Analisis.</p>
                        </div>
                    ) : (
                        <div 
                            className="ai-content"
                            dangerouslySetInnerHTML={{ 
                                __html: formatAnalysisText(analysis)
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Komponen PestEconomicAnalysis untuk analisis ambang ekonomi hama
const PestEconomicAnalysis = () => {
  const [pestData, setPestData] = React.useState({
    cropType: 'Padi',
    pestType: 'Wereng Coklat',
    cropPrice: '10000',    // Rp/kg
    controlCost: '500000', // Rp
    yieldLoss: '5',        // 5% loss per pest
    pestDensity: '20',     // pests found
    sampleArea: '10',      // m²
    potentialYield: '6000', // kg/ha
    controlEffectiveness: '80', // %
    laborCost: '200000',   // Rp
    materialCost: '300000', // Rp
    season: 'hujan',       // Musim
    plantingSeason: 'MT1', // Musim Tanam
    samplePoints: '5',     // Jumlah Titik Sampel
    damageIntensity: '10'  // Intensitas Kerusakan (%)
  });
  const [analysis, setAnalysis] = React.useState(null);
  const [charts, setCharts] = React.useState([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [aiAnalysis, setAiAnalysis] = React.useState('');
  const [analysisProgress, setAnalysisProgress] = React.useState(0);
  const chartRefs = [React.useRef(null), React.useRef(null), React.useRef(null), React.useRef(null), React.useRef(null)];

  React.useEffect(() => {
    calculateEconomicThreshold();
  }, [pestData]);

  const handleInputChange = (field, value) => {
    setPestData(prevData => ({
      ...prevData,
      [field]: value
    }));
  };

  const calculateEconomicThreshold = () => {
    const cropPrice = parseFloat(pestData.cropPrice);
    const controlCost = parseFloat(pestData.controlCost);
    const yieldLoss = parseFloat(pestData.yieldLoss) / 100;
    const pestDensity = parseFloat(pestData.pestDensity);
    const sampleArea = parseFloat(pestData.sampleArea);
    const potentialYield = parseFloat(pestData.potentialYield);
    const controlEffectiveness = parseFloat(pestData.controlEffectiveness) / 100;
    const laborCost = parseFloat(pestData.laborCost);
    const materialCost = parseFloat(pestData.materialCost);
    const samplePoints = parseFloat(pestData.samplePoints);
    const damageIntensity = parseFloat(pestData.damageIntensity) / 100;

    if (isNaN(cropPrice) || isNaN(controlCost) || isNaN(yieldLoss) || isNaN(pestDensity) || isNaN(sampleArea) || isNaN(potentialYield) || isNaN(controlEffectiveness) || isNaN(laborCost) || isNaN(materialCost) || isNaN(samplePoints) || isNaN(damageIntensity)) {
      console.error('Invalid input detected');
      return;
    }

    const totalControlCost = controlCost + laborCost + materialCost;
    const economicThreshold = totalControlCost / (cropPrice * yieldLoss * potentialYield * controlEffectiveness);
    const densityPerArea = pestDensity / sampleArea;
    
    // Generate data points for visualization
    const dataPoints = [];
    const maxDensity = Math.max(densityPerArea * 2, economicThreshold * 2);
    for (let i = 0; i <= 10; i++) {
      const density = (maxDensity * i) / 10;
      const loss = cropPrice * yieldLoss * density * potentialYield;
      const control = density > economicThreshold ? totalControlCost : 0;
      const netLoss = loss + control;

      dataPoints.push({
        density,
        loss,
        control,
        netLoss
      });
    }

    createCharts(dataPoints, economicThreshold);

    setAnalysis({
      economicThreshold,
      currentDensity: densityPerArea,
      recommendation: densityPerArea > economicThreshold
        ? 'Tindakan pengendalian hama diperlukan karena kepadatan hama melebihi ambang ekonomi.'
        : 'Tindakan pengendalian belum diperlukan karena kepadatan hama masih di bawah ambang ekonomi.',
      status: densityPerArea > economicThreshold ? 'danger' : 'safe'
    });
  };

  const createCharts = (dataPoints, economicThreshold) => {
    charts.forEach(chart => chart.destroy());

    const newCharts = chartRefs.map((ref, index) => {
      if (!ref.current) return null;
      const ctx = ref.current.getContext('2d');

      switch (index) {
        case 0:
          return new Chart(ctx, {
            type: 'line',
            data: {
              labels: dataPoints.map(dp => dp.density.toFixed(1) + ' hama/m²'),
              datasets: [
                {
                  label: 'Kerugian Ekonomi',
                  data: dataPoints.map(dp => dp.loss),
                  borderColor: 'rgb(239, 68, 68)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  tension: 0.4,
                  fill: true
                },
                {
                  label: 'Ambang Ekonomi',
                  data: dataPoints.map(() => economicThreshold),
                  borderColor: 'rgb(234, 179, 8)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  fill: false
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'Kepadatan Hama (hama/m²)'
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: 'Nilai (Rp)'
                  },
                  beginAtZero: true
                }
              },
              plugins: {
                title: {
                  display: true,
                  text: 'Kerugian Ekonomi dan Ambang Ekonomi vs Kepadatan Hama',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                legend: {
                  position: 'bottom'
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.dataset.label}: Rp ${context.raw.toLocaleString()}`;
                    }
                  }
                }
              }
            }
          });
        case 1:
          return new Chart(ctx, {
            type: 'bar',
            data: {
              labels: dataPoints.map(dp => dp.density.toFixed(1) + ' hama/m²'),
              datasets: [{
                label: 'Biaya Pengendalian',
                data: dataPoints.map(dp => dp.control),
                backgroundColor: 'rgba(16, 185, 129, 0.3)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'Kepadatan Hama (hama/m²)'
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: 'Biaya Pengendalian (Rp)'
                  },
                  beginAtZero: true
                }
              },
              plugins: {
                title: {
                  display: true,
                  text: 'Biaya Pengendalian vs Kepadatan Hama',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                legend: {
                  position: 'bottom'
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `Biaya: Rp ${context.raw.toLocaleString()}`;
                    }
                  }
                }
              }
            }
          });
        case 2:
          return new Chart(ctx, {
            type: 'pie',
            data: {
              labels: ['Biaya Tenaga Kerja', 'Biaya Material', 'Biaya Pengendalian'],
              datasets: [{
                data: [pestData.laborCost, pestData.materialCost, pestData.controlCost],
                backgroundColor: ['rgb(54, 162, 235)', 'rgb(255, 206, 86)', 'rgb(75, 192, 192)'],
                hoverOffset: 4
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Distribusi Biaya Pengendalian',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                legend: {
                  position: 'bottom'
                }
              }
            }
          });
        case 3:
          return new Chart(ctx, {
            type: 'bar',
            data: {
              labels: dataPoints.map(dp => dp.density.toFixed(1) + ' hama/m²'),
              datasets: [
                {
                  label: 'Kerugian Ekonomi',
                  data: dataPoints.map(dp => dp.loss),
                  backgroundColor: 'rgba(239, 68, 68, 0.3)',
                  stack: 'Stack 0'
                },
                {
                  label: 'Biaya Pengendalian',
                  data: dataPoints.map(dp => dp.control),
                  backgroundColor: 'rgba(16, 185, 129, 0.3)',
                  stack: 'Stack 0'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  stacked: true,
                  title: {
                    display: true,
                    text: 'Kepadatan Hama (hama/m²)'
                  }
                },
                y: {
                  stacked: true,
                  title: {
                    display: true,
                    text: 'Total Biaya dan Kerugian (Rp)'
                  },
                  beginAtZero: true
                }
              },
              plugins: {
                title: {
                  display: true,
                  text: 'Total Biaya dan Kerugian vs Kepadatan Hama',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                legend: {
                  position: 'bottom'
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.dataset.label}: Rp ${context.raw.toLocaleString()}`;
                    }
                  }
                }
              }
            }
          });
        case 4:
          return new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ['Biaya Tenaga Kerja', 'Biaya Material', 'Biaya Pengendalian'],
              datasets: [
                {
                  label: 'Biaya',
                  data: [pestData.laborCost, pestData.materialCost, pestData.controlCost],
                  backgroundColor: 'rgba(54, 162, 235, 0.3)',
                  stack: 'Stack 0'
                },
                {
                  label: 'Persentase',
                  data: [((pestData.laborCost / (pestData.laborCost + pestData.materialCost + pestData.controlCost)) * 100).toFixed(2), ((pestData.materialCost / (pestData.laborCost + pestData.materialCost + pestData.controlCost)) * 100).toFixed(2), ((pestData.controlCost / (pestData.laborCost + pestData.materialCost + pestData.controlCost)) * 100).toFixed(2)],
                  backgroundColor: 'rgba(255, 206, 86, 0.3)',
                  stack: 'Stack 1'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  stacked: true,
                  title: {
                    display: true,
                    text: 'Jenis Biaya'
                  }
                },
                y: {
                  stacked: true,
                  title: {
                    display: true,
                    text: 'Nilai (Rp) / Persentase (%)'
                  },
                  beginAtZero: true
                }
              },
              plugins: {
                title: {
                  display: true,
                  text: 'Biaya dan Persentase vs Jenis Biaya',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                legend: {
                  position: 'bottom'
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.dataset.label}: ${context.raw.toLocaleString()}`;
                    }
                  }
                }
              }
            }
          });
        default:
          return null;
      }
    });

    setCharts(newCharts);
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAiAnalysis('');

    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    try {
      const prompt = `Analisis ambang ekonomi hama untuk tanaman berikut:
      
Data Tanaman:
- Jenis Tanaman: ${pestData.cropType}
- Hama: ${pestData.pestType}
- Fase Pertumbuhan: ${pestData.growthPhase}
- Harga Panen: Rp${parseInt(pestData.cropPrice).toLocaleString()}/kg
- Potensi Hasil: ${pestData.potentialYield} kg/ha
- Musim: ${pestData.season === 'hujan' ? 'Musim Hujan' : pestData.season === 'kemarau' ? 'Musim Kemarau' : 'Musim Pancaroba'}
- Musim Tanam: ${pestData.plantingSeason}

Data Pengamatan:
- Metode Pengamatan: ${pestData.observationMethod}
- Jumlah Titik Sampel: ${pestData.samplePoints}
- Kepadatan Hama: ${pestData.pestDensity} hama/m²
- Area Sampel: ${pestData.sampleArea} m²
- Intensitas Kerusakan: ${pestData.damageIntensity}%
- Persentase Kehilangan Hasil: ${pestData.yieldLoss}%

Data Pengendalian:
- Metode Pengendalian: ${pestData.controlMethod}
- Biaya Pengendalian Total: Rp${parseInt(pestData.controlCost).toLocaleString()}/ha
- Biaya Tenaga Kerja: Rp${parseInt(pestData.laborCost).toLocaleString()}/ha
- Biaya Material: Rp${parseInt(pestData.materialCost).toLocaleString()}/ha
- Efektivitas Pengendalian: ${pestData.controlEffectiveness}%

Hasil Perhitungan:
- Ambang Ekonomi: ${analysis?.economicThreshold?.toFixed(2) || 'Belum dihitung'} hama/m²
- Kepadatan Saat Ini: ${analysis?.currentDensity?.toFixed(2) || 'Belum dihitung'} hama/m²

Berikan analisis komprehensif mengenai:
1. Evaluasi tingkat serangan hama saat ini dibandingkan dengan ambang ekonomi
2. Rekomendasi tindakan pengendalian berdasarkan metode yang dipilih
3. Analisis cost-benefit dari tindakan pengendalian
4. Saran untuk monitoring dan pencegahan
5. Pertimbangan khusus berdasarkan musim dan musim tanam saat ini
6. Strategi pengendalian yang disesuaikan dengan kondisi musim

Berikan analisis dalam format yang terstruktur dan mudah dibaca, dengan penekanan pada aspek ekonomi dan keberlanjutan.`;

      const result = await getGeminiAnalysis(prompt, pestData.month, pestData.cropType);
      setAiAnalysis(result);
      clearInterval(progressInterval);
      setAnalysisProgress(100);
    } catch (error) {
      console.error('Error in AI analysis:', error);
      setAiAnalysis('Maaf, terjadi kesalahan dalam analisis AI. Silakan coba lagi.');
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 500);
    }
  };

  const formatText = (text) => {
    // Format bold text (between **text**)
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Format italic text (between _text_)
    text = text.replace(/_(.*?)_/g, "<em>$1</em>");
    
    // Format underlined text (between __text__)
    text = text.replace(/__(.*?)__/g, "<u>$1</u>");
    
    return text;
  };

  const renderFormattedText = (text) => {
    return { __html: formatText(text) };
  };

  return (
    <div className="container" style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      backgroundColor: '#f9fafb', 
      borderRadius: '8px', 
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <div className="form-container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div className="form-section" style={{ flex: '1 1 45%', minWidth: '280px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#059669', borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>Data Tanaman dan Hama</h3>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Jenis Tanaman</label>
            <select name="cropType" value={pestData.cropType} onChange={(e) => handleInputChange('cropType', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="Padi">Padi (Oryza sativa)</option>
              <option value="Jagung">Jagung (Zea mays)</option>
              <option value="Kedelai">Kedelai (Glycine max)</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>Pilih jenis tanaman yang akan dianalisis</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Jenis Hama</label>
            <select name="pestType" value={pestData.pestType} onChange={(e) => handleInputChange('pestType', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="Wereng Coklat">Wereng Coklat (Nilaparvata lugens)</option>
              <option value="Penggerek Batang">Penggerek Batang Kuning (Scirpophaga incertulas)</option>
              <option value="Ulat Grayak">Ulat Grayak (Spodoptera frugiperda)</option>
              <option value="Walang Sangit">Walang Sangit (Leptocorisa oratorius)</option>
              <option value="Tikus Sawah">Tikus Sawah (Rattus argentiventer)</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>Termasuk nama ilmiah spesies hama target</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Fase Pertumbuhan Tanaman</label>
            <select name="growthPhase" value={pestData.growthPhase} onChange={(e) => handleInputChange('growthPhase', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="vegetatif-awal">Vegetatif Awal (0-30 HST)</option>
              <option value="vegetatif-aktif">Vegetatif Aktif (31-60 HST)</option>
              <option value="reproduktif">Reproduktif/Pembungaan (61-90 HST)</option>
              <option value="pemasakan">&gt;90 HST</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>HST = Hari Setelah Tanam</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Potensi Hasil Panen (kg/ha)</label>
            <input
              type="text"
              name="potentialYield"
              value={pestData.potentialYield}
              onChange={(e) => handleInputChange('potentialYield', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Estimasi hasil panen dalam kondisi optimal tanpa serangan hama</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Harga Jual Hasil Panen (Rp/kg)</label>
            <input
              type="text"
              name="cropPrice"
              value={pestData.cropPrice}
              onChange={(e) => handleInputChange('cropPrice', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Harga pasar terkini untuk kualitas standar</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Musim</label>
            <select name="season" value={pestData.season} onChange={(e) => handleInputChange('season', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="hujan">Musim Hujan</option>
              <option value="kemarau">Musim Kemarau</option>
              <option value="pancaroba">Musim Pancaroba</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>Musim yang sedang berlangsung</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Musim Tanam</label>
            <select name="plantingSeason" value={pestData.plantingSeason} onChange={(e) => handleInputChange('plantingSeason', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="MT1">Musim Tanam 1 (MT1)</option>
              <option value="MT2">Musim Tanam 2 (MT2)</option>
              <option value="MT3">Musim Tanam 3 (MT3)</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>Musim tanam yang sedang berlangsung</small>
          </div>
        </div>

        <div className="form-section" style={{ flex: '1 1 45%', minWidth: '280px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#059669', borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>Data Pengamatan Hama</h3>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Metode Pengamatan</label>
            <select name="observationMethod" value={pestData.observationMethod} onChange={(e) => handleInputChange('observationMethod', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="langsung">Pengamatan Langsung</option>
              <option value="jaring">Jaring Serangga</option>
              <option value="perangkap">Perangkap Feromon</option>
              <option value="light-trap">Light Trap</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>Metode yang digunakan dalam pengamatan populasi hama</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Jumlah Titik Sampel</label>
            <input
              type="number"
              name="samplePoints"
              value={pestData.samplePoints}
              onChange={(e) => handleInputChange('samplePoints', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Minimal 5 titik sampel per hektar</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Luas Area Sampel (m²)</label>
            <input
              type="text"
              name="sampleArea"
              value={pestData.sampleArea}
              onChange={(e) => handleInputChange('sampleArea', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Area pengamatan per titik sampel</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Jumlah Hama Ditemukan (per titik sampel)</label>
            <input
              type="text"
              name="pestDensity"
              value={pestData.pestDensity}
              onChange={(e) => handleInputChange('pestDensity', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Rata-rata jumlah hama yang ditemukan per titik sampel</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Intensitas Kerusakan (%)</label>
            <input
              type="text"
              name="damageIntensity"
              value={pestData.damageIntensity}
              onChange={(e) => handleInputChange('damageIntensity', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Persentase kerusakan tanaman yang diamati</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Penurunan Hasil per Hama (%)</label>
            <input
              type="text"
              name="yieldLoss"
              value={pestData.yieldLoss}
              onChange={(e) => handleInputChange('yieldLoss', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Estimasi kehilangan hasil per individu hama</small>
          </div>
        </div>

        <div className="form-section" style={{ flex: '1 1 45%', minWidth: '280px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#059669', borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>Data Pengendalian</h3>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Metode Pengendalian</label>
            <select name="controlMethod" value={pestData.controlMethod} onChange={(e) => handleInputChange('controlMethod', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="kimia">Pengendalian Kimia</option>
              <option value="biologis">Pengendalian Biologis</option>
              <option value="kultur-teknis">Kultur Teknis</option>
              <option value="terpadu">Pengendalian Terpadu</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px' }}>Metode pengendalian yang akan diterapkan</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Biaya Pengendalian (Rp/ha)</label>
            <input
              type="text"
              name="controlCost"
              value={pestData.controlCost}
              onChange={(e) => handleInputChange('controlCost', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Total biaya aplikasi pengendalian per hektar</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Efektivitas Pengendalian (%)</label>
            <input
              type="text"
              name="controlEffectiveness"
              value={pestData.controlEffectiveness}
              onChange={(e) => handleInputChange('controlEffectiveness', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Persentase keberhasilan pengendalian berdasarkan penelitian</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Biaya Tenaga Kerja (Rp/ha)</label>
            <input
              type="text"
              name="laborCost"
              value={pestData.laborCost}
              onChange={(e) => handleInputChange('laborCost', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Upah pekerja untuk aplikasi pengendalian</small>
          </div>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Biaya Bahan Pengendalian (Rp/ha)</label>
            <input
              type="text"
              name="materialCost"
              value={pestData.materialCost}
              onChange={(e) => handleInputChange('materialCost', e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Biaya pestisida atau bahan pengendalian lainnya</small>
          </div>
        </div>
      </div>
      
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
        padding: '20px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        {chartRefs.map((ref, index) => (
          <div key={index} style={{ 
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            padding: '20px',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <canvas 
              ref={ref} 
              style={{ 
                width: '100%', 
                height: '100%', 
                minHeight: '350px',
                objectFit: 'contain' 
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ 
        backgroundColor: '#fff',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginTop: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '10px',
          borderBottom: '2px solid #ddd'
        }}>
          <h3 style={{
            color: '#059669',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            margin: 0
          }}>
            Analisis Ambang Ekonomi Hama dengan AI
          </h3>
          <button
            onClick={runAIAnalysis}
            disabled={isAnalyzing}
            style={{
              padding: '10px 20px',
              backgroundColor: isAnalyzing ? '#9ca3af' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {isAnalyzing ? 'Sedang Menganalisis...' : 'Analisis dengan AI'}
          </button>
        </div>

        {/* Progress Bar */}
        {isAnalyzing && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#059669'
              }}>
                Proses Analisis
              </span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#059669'
              }}>
                {analysisProgress}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: '#e5e7eb',
              borderRadius: '9999px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${analysisProgress}%`,
                  height: '100%',
                  backgroundColor: '#059669',
                  borderRadius: '9999px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {aiAnalysis && !isAnalyzing && (
          <div style={{
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #dcfce7',
            padding: '20px'
          }}>
            <div style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#059669',
              marginBottom: '16px'
            }}>
              Hasil Analisis AI
            </div>
            <div style={{
              whiteSpace: 'pre-line',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}>
              {aiAnalysis.split('\n').map((line, index) => {
                if (line.trim().startsWith('-')) {
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <span style={{ color: '#059669' }}>•</span>
                      <span dangerouslySetInnerHTML={renderFormattedText(line.trim().substring(1))} />
                    </div>
                  );
                }
                if (line.trim().match(/^\d+\./)) {
                  return (
                    <div key={index} style={{
                      fontWeight: '600',
                      color: '#059669',
                      marginTop: '16px',
                      marginBottom: '8px'
                    }}
                    dangerouslySetInnerHTML={renderFormattedText(line)} />
                  );
                }
                return line.trim() && (
                  <p key={index} style={{ marginBottom: '8px' }}
                    dangerouslySetInnerHTML={renderFormattedText(line)} />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Komponen untuk Analisa Penelitian
const ResearchAnalysis = () => {
  const [treatmentData, setTreatmentData] = React.useState([
    { treatment: 'Perlakuan A', replications: [5, 6, 7] },
    { treatment: 'Perlakuan B', replications: [8, 7, 9] }
  ]);

  const [editingLabel, setEditingLabel] = React.useState(null);
  const [editingHeader, setEditingHeader] = React.useState(null);
  const [replicationLabels, setReplicationLabels] = React.useState([]);

  React.useEffect(() => {
    // Initialize replication labels if empty
    if (replicationLabels.length === 0 && treatmentData[0]) {
      setReplicationLabels(treatmentData[0].replications.map((_, i) => `Ulangan ${i + 1}`));
    }
  }, [treatmentData]);

  const addColumn = () => {
    const newData = treatmentData.map(row => ({ ...row, replications: [...row.replications, 0] }));
    setTreatmentData(newData);
    setReplicationLabels([...replicationLabels, `Ulangan ${replicationLabels.length + 1}`]);
  };

  const addRow = () => {
    const newRow = {
      treatment: `Perlakuan ${String.fromCharCode(65 + treatmentData.length)}`,
      replications: Array(treatmentData[0].replications.length).fill(0)
    };
    setTreatmentData([...treatmentData, newRow]);
  };

  const deleteRow = (rowIndex) => {
    const newData = treatmentData.filter((_, index) => index !== rowIndex);
    setTreatmentData(newData);
  };

  const deleteColumn = (colIndex) => {
    const newData = treatmentData.map(row => ({
      ...row,
      replications: row.replications.filter((_, index) => index !== colIndex)
    }));
    const newLabels = replicationLabels.filter((_, index) => index !== colIndex);
    setTreatmentData(newData);
    setReplicationLabels(newLabels);
  };

  const [dmrtResults, setDmrtResults] = React.useState(null);

  const handleInputChange = (index, repIndex, value) => {
    const newData = [...treatmentData];
    // Konversi ke number dan validasi
    const numValue = value === '' ? 0 : Number(value);
    if (!isNaN(numValue)) {
      newData[index].replications[repIndex] = numValue;
      setTreatmentData(newData);
    }
  };

  const handleLabelEdit = (index, newValue) => {
    const newData = [...treatmentData];
    newData[index].treatment = newValue;
    setTreatmentData(newData);
    setEditingLabel(null);
  };

  React.useEffect(() => {
    if (treatmentData && treatmentData.length > 0) {
      const results = calculateDMRT();
      setDmrtResults(results);
    }
  }, [treatmentData]);

  const handleHeaderEdit = (index, newValue) => {
    const newLabels = [...replicationLabels];
    newLabels[index] = newValue;
    setReplicationLabels(newLabels);
    setEditingHeader(null);
  };

  const calculateMean = (numbers) => {
    return numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
  };

  const calculateStandardDeviation = (numbers) => {
    const mean = calculateMean(numbers);
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  };

  const calculateCV = (numbers) => {
    const mean = calculateMean(numbers);
    const sd = calculateStandardDeviation(numbers);
    return (sd / mean) * 100;
  };

  const calculateStatistics = () => {
    return treatmentData.map(row => ({
      treatment: row.treatment,
      mean: calculateMean(row.replications),
      sd: calculateStandardDeviation(row.replications),
      sum: row.replications.reduce((acc, val) => acc + val, 0),
      cv: calculateCV(row.replications)
    }));
  };

  // ANOVA Calculations
  const calculateANOVA = () => {
    // More robust input validation
    if (treatmentData.length < 2) {
      return {
        error: 'Insufficient treatments for ANOVA',
        valid: false
      };
    }
  
    // Normalize replications length
    const replicationLengths = treatmentData.map(row => row.replications.length);
    if (new Set(replicationLengths).size > 1) {
      console.warn('Unequal replications may affect ANOVA accuracy');
    }
  
    // Existing calculations with enhanced error handling
    const n = treatmentData.reduce((acc, row) => acc + row.replications.length, 0);
    const k = treatmentData.length;
    const r = treatmentData[0].replications.length;
  
    const totalSum = treatmentData.reduce((acc, row) => 
      acc + row.replications.reduce((sum, val) => sum + val, 0), 0);
    const CF = Math.pow(totalSum, 2) / n;
  
    const TSS = treatmentData.reduce((acc, row) => 
      acc + row.replications.reduce((sum, val) => sum + Math.pow(val, 2), 0), 0) - CF;
  
    const TrSS = treatmentData.reduce((acc, row) => {
      const treatmentSum = row.replications.reduce((sum, val) => sum + val, 0);
      return acc + Math.pow(treatmentSum, 2) / r;
    }, 0) - CF;
  
    const ESS = TSS - TrSS;
  
    const df_treatment = k - 1;
    const df_error = n - k;
    const df_total = n - 1;
  
    const MS_treatment = TrSS / df_treatment;
    const MS_error = ESS / df_error;
  
    const F_value = MS_treatment / MS_error;
    const F_table = calculateFTable(df_treatment, df_error, 0.05);
  
    // Enhanced statistical interpretation
    const significanceLevel = F_value > F_table ? 'Signifikan' : 'Tidak Signifikan';
  
    return {
      valid: true,
      sources: [
        {
          source: 'Perlakuan',
          df: df_treatment,
          SS: TrSS,
          MS: MS_treatment,
          F_value: F_value,
          F_table: F_table,
          significance: significanceLevel
        },
        {
          source: 'Galat',
          df: df_error,
          SS: ESS,
          MS: MS_error
        },
        {
          source: 'Total',
          df: df_total,
          SS: TSS
        }
      ],
      interpretation: {
        significanceLevel: significanceLevel,
        recommendation: significanceLevel === 'Signifikan'
          ? 'Terdapat perbedaan nyata antar perlakuan'
          : 'Tidak terdapat perbedaan nyata antar perlakuan'
      },
      details: {
        totalSampleSize: n,
        treatmentGroups: k,
        replicationsPerGroup: r,
        MS_error: MS_error
      }
    };
  };

  // Helper function to calculate F table value
  const calculateFTable = (df1, df2, alpha) => {
    // This is a simplified approximation of F table values
    // In practice, you should use a proper F-distribution table or statistical library
    const approximateFTable = {
      '1,10': 4.96,
      '2,10': 4.10,
      '3,10': 3.71,
      '4,10': 3.48,
      '5,10': 3.33,
      '6,10': 3.22,
      '7,10': 3.14,
      '8,10': 3.07,
      '9,10': 3.02,
      '10,10': 2.98
    };

    const key = `${df1},${Math.min(10, df2)}`;
    return approximateFTable[key] || 4.96; // Default to 1,10 if not found
  };

  // DMRT Calculations
  const calculateDMRT = () => {
    // Validate data
    if (treatmentData.length < 2) {
      return {
        error: 'Insufficient treatments for DMRT',
        valid: false,
        treatmentComparisons: [],
        overallInterpretation: {
          totalTreatments: 0,
          significantDifferences: 0
        }
      };
    }
  
    // Calculate means and sort
    const means = calculateStatistics().map(stat => ({
      treatment: stat.treatment,
      mean: stat.mean
    })).sort((a, b) => a.mean - b.mean); // Sort from lowest to highest
  
    // Degrees of freedom from error
    const anovaResults = calculateANOVA();
    const df_error = anovaResults.sources[1].df;
    const MS_error = anovaResults.details.MS_error;
    const r = anovaResults.details.replicationsPerGroup;
  
    // Duncan's Multiple Range Test
    const significanceDetails = [];
    const studentizedRangeValues = {
      2: { 0.05: 2.77 },
      3: { 0.05: 3.31 },
      4: { 0.05: 3.71 },
      5: { 0.05: 4.00 }
    };
  
    // Comprehensive pairwise comparisons
    means.forEach((currentTreatment, currentIndex) => {
      const significantComparisons = [];
      const nonSignificantComparisons = [];
  
      means.forEach((compareTreatment, compareIndex) => {
        if (currentIndex !== compareIndex) {
          // Calculate critical range
          const p = Math.abs(currentIndex - compareIndex) + 1;
          const studentizedRange = studentizedRangeValues[p]?.[0.05] || 4.00;
          const criticalRange = studentizedRange * Math.sqrt(MS_error / r);
          
          // Calculate absolute difference
          const difference = Math.abs(currentTreatment.mean - compareTreatment.mean);
          const isSignificant = difference > criticalRange;
  
          const comparisonDetail = {
            treatment1: currentTreatment.treatment,
            treatment2: compareTreatment.treatment,
            mean1: currentTreatment.mean,
            mean2: compareTreatment.mean,
            absoluteDifference: difference.toFixed(2),
            criticalRange: criticalRange.toFixed(2),
            significant: isSignificant,
            interpretation: isSignificant 
              ? `Signifikan perbedaan antara ${currentTreatment.treatment} dan ${compareTreatment.treatment}` 
              : `Tidak signifikan perbedaan antara ${currentTreatment.treatment} dan ${compareTreatment.treatment}`
          };
  
          if (isSignificant) {
            significantComparisons.push(comparisonDetail);
          } else {
            nonSignificantComparisons.push(comparisonDetail);
          }
        }
      });
  
      // Assign Duncan's grouping notation
      const groupNotation = String.fromCharCode(97 + currentIndex); // 'a', 'b', 'c', etc.
  
      significanceDetails.push({
        treatment: currentTreatment.treatment,
        mean: currentTreatment.mean,
        grouping: groupNotation,
        significantComparisons: significantComparisons,
        nonSignificantComparisons: nonSignificantComparisons,
        significanceExplanation: significantComparisons.length > 0
          ? `Berbeda nyata dengan: ${significantComparisons.map(comp => comp.treatment2).join(', ')}`
          : 'Tidak berbeda nyata dengan perlakuan lain'
      });
    });
  
    // Sort significanceDetails by mean (lowest to highest)
    significanceDetails.sort((a, b) => a.mean - b.mean);
  
    return {
      valid: true,
      treatmentComparisons: significanceDetails,
      overallInterpretation: {
        totalTreatments: means.length,
        significantDifferences: significanceDetails.filter(
          detail => detail.significantComparisons.length > 0
        ).length
      }
    };
  };
  
    const renderDMRTResults = () => {
      // Check if results are valid
      if (!dmrtResults || !dmrtResults.treatmentComparisons || dmrtResults.treatmentComparisons.length === 0) {
        return <div>Tidak dapat melakukan analisis DMRT</div>;
      }
  
      return (
        <div>
          <h3>Analisis Perbedaan Nyata Perlakuan (DMRT)</h3>
          {dmrtResults.treatmentComparisons.map((comparison, index) => (
            <div key={index} style={{ marginBottom: '15px' }}>
              <h4>
                {comparison.treatment} 
                <small style={{ marginLeft: '10px' }}>
                  (Rata-rata: {comparison.mean.toFixed(2)}, Kelompok: {comparison.grouping})
                </small>
              </h4>
              
              <p>{comparison.significanceExplanation}</p>
              
              {comparison.significantComparisons.length > 0 && (
                <div>
                  <strong>Perbandingan Signifikan:</strong>
                  <ul>
                    {comparison.significantComparisons.map((comp, compIndex) => (
                      <li key={compIndex}>
                        {comp.interpretation} 
                        <br />
                        <small>
                          Selisih: {comp.absoluteDifference}, 
                          Rentang Kritis: {comp.criticalRange}
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          
          <div style={{ marginTop: '20px', backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
            <strong>Ringkasan Analisis:</strong>
            <p>
              Total Perlakuan: {dmrtResults.overallInterpretation.totalTreatments}
              <br />
              Perlakuan dengan Perbedaan Signifikan: {dmrtResults.overallInterpretation.significantDifferences}
            </p>
          </div>
        </div>
      );
    };  

  const [isAiAnalyzing, setIsAiAnalyzing] = React.useState(false);
  const [aiAnalysisProgress, setAiAnalysisProgress] = React.useState(0);
  const [aiAnalysis, setAiAnalysis] = React.useState('');

  const analyzeWithAI = async () => {
    // Start analyzing state
  setIsAiAnalyzing(true);
  setAiAnalysisProgress(0);

  // Simulate progress
  const updateProgress = setInterval(() => {
    setAiAnalysisProgress((prevProgress) => {
      if (prevProgress >= 90) {
        clearInterval(updateProgress);
        return 90;
      }
      return prevProgress + 10;
    });
  }, 500);
    
  try {
    // Prepare data for AI analysis (keep existing code)
    const fullAnalysisData = {
      treatmentData: treatmentData,
      anovaResults: calculateRobustANOVA(treatmentData),
      dmrtResults: calculateDMRT(),
      normalityTest: checkNormality(treatmentData),
      homogeneityTest: checkVarianceHomogeneity(treatmentData),
      fTable: calculateFTable(
        treatmentData[0].replications.length - 1, 
        (treatmentData.length - 1) * (treatmentData[0].replications.length - 1)
      )
    };

    // Siapkan prompt AI yang lebih detail
    const prompt = `Analisis Komprehensif Penelitian Pertanian:

      DATA PENELITIAN:
      - Jumlah Perlakuan: ${treatmentData.length}
      - Jumlah Ulangan: ${treatmentData[0].replications.length}

      STATISTIK DESKRIPTIF:
      1. Nilai Rata-rata per Perlakuan:
      ${treatmentData.map(row => `- ${row.treatment}: ${calculateMean(row.replications).toFixed(2)}`).join('\n')}

      2. Standar Deviasi per Perlakuan:
      ${treatmentData.map(row => `- ${row.treatment}: ${calculateStandardDeviation(row.replications).toFixed(2)}`).join('\n')}

      UJI PRASYARAT ANALISIS:
      1. Uji Normalitas:
      - Metode: Shapiro-Wilk
      - Hasil: ${JSON.stringify(fullAnalysisData.normalityTest)}

      2. Uji Homogenitas Varians:
      - Metode: Levene's Test
      - Hasil: ${JSON.stringify(fullAnalysisData.homogeneityTest)}

      ANALISIS VARIAN (ANOVA):
      1. Ringkasan ANOVA:
      ${JSON.stringify(fullAnalysisData.anovaResults, null, 2)}

      2. Tabel F:
      - Derajat Kebebasan: ${JSON.stringify(fullAnalysisData.fTable)}

      ANALISIS UJI DUNCAN (DMRT):
      1. Komparasi Perlakuan:
      ${dmrtResults.treatmentComparisons.map(comparison => 
        `- ${comparison.treatment1} vs ${comparison.treatment2}: ${comparison.significanceStatus}`
      ).join('\n')}

      2. Ringkasan DMRT:
      - Total Perlakuan: ${dmrtResults.overallInterpretation.totalTreatments}
      - Perlakuan dengan Perbedaan Signifikan: ${dmrtResults.overallInterpretation.significantDifferences}

      INTERPRETASI STATISTIK LANJUTAN:
      Berikan analisis komprehensif yang mencakup:
      1. Kesimpulan statistik berdasarkan nilai rata-rata dan standar deviasi
      2. Kesimpulan statistik berdasarkan uji normalitas dan homogenitas
      3. Interpretasi hasil ANOVA secara mendalam
      4. Interpretasi hasil DMRT secara mendalam
      5. Simpulkan hasil dari no 1 - 4 secara detail
      6. Potensi implikasi praktis dari hasil penelitian

      Gunakan bahasa formal, ilmiah, dan mudah dipahami, dengan fokus pada konteks pertanian Indonesia.`;

    // Call AI analysis
    const result = await getGeminiAnalysis(prompt, 'N/A', 'N/A');
    
    // Clear interval and set full progress
    clearInterval(updateProgress);
    setAiAnalysisProgress(100);
    
    // Short delay to show complete progress
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setAiAnalysis(result);
  } catch (error) {
    console.error('Gagal melakukan analisis AI:', error);
    setAiAnalysis('Terjadi kesalahan dalam analisis. Silakan coba lagi.');
  } finally {
    // Reset states
    setIsAiAnalyzing(false);
    setAiAnalysisProgress(0);
  }
};

  return (
    <div className="container" style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      backgroundColor: '#f9fafb', 
      borderRadius: '8px', 
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
    }}>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={addRow} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Tambah Perlakuan</button>
        <button onClick={addColumn} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Tambah Kolom Ulangan</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '200px' }} />
            {treatmentData[0].replications.map((_, index) => (
              <col key={index} style={{ width: '120px' }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Jenis Perlakuan</th>
              {treatmentData[0].replications.map((_, repIndex) => (
                <th key={repIndex} style={{ border: '1px solid #ddd', padding: '8px', position: 'relative', background: '#f8f9fa' }}>
                  <div style={{ paddingRight: '24px', position: 'relative' }}>
                    {editingHeader === repIndex ? (
                      <input
                        type="text"
                        defaultValue={replicationLabels[repIndex]}
                        onBlur={(e) => handleHeaderEdit(repIndex, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleHeaderEdit(repIndex, e.target.value);
                          }
                        }}
                        autoFocus
                        style={{ 
                          width: '100%',
                          padding: '4px',
                          border: '1px solid #10b981',
                          borderRadius: '4px'
                        }}
                      />
                    ) : (
                      <span 
                        onClick={() => setEditingHeader(repIndex)}
                        style={{ cursor: 'pointer' }}
                        title="Klik untuk edit"
                      >
                        {replicationLabels[repIndex]}
                      </span>
                    )}
                    <button 
                      onClick={() => deleteColumn(repIndex)} 
                      style={{ 
                        position: 'absolute',
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#ef4444',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}
                      title="Hapus kolom"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {treatmentData.map((row, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px', position: 'relative' }}>
                  <div style={{ paddingRight: '24px', position: 'relative' }}>
                    {editingLabel === index ? (
                      <input
                        type="text"
                        defaultValue={row.treatment}
                        onBlur={(e) => handleLabelEdit(index, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleLabelEdit(index, e.target.value);
                          }
                        }}
                        autoFocus
                        style={{ 
                          width: '100%',
                          padding: '4px',
                          border: '1px solid #10b981',
                          borderRadius: '4px'
                        }}
                      />
                    ) : (
                      <span 
                        onClick={() => setEditingLabel(index)}
                        style={{ cursor: 'pointer' }}
                        title="Klik untuk edit"
                      >
                        {row.treatment}
                      </span>
                    )}
                    <button 
                      onClick={() => deleteRow(index)} 
                      style={{ 
                        position: 'absolute',
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#ef4444',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}
                      title="Hapus baris"
                    >
                      ×
                    </button>
                  </div>
                </td>
                {row.replications.map((rep, repIndex) => (
                  <td key={repIndex} style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <input
                      type="number"
                      value={rep} // Hilangkan || '' agar nilai 0 tetap ditampilkan
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                        handleInputChange(index, repIndex, value);
                      }}
                      onFocus={(e) => {
                        e.target.select();
                      }}
                      style={{ 
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        '-moz-appearance': 'textfield',
                        textAlign: 'center'
                      }}
                      step="any"
                      inputMode="decimal"
                      min="0"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '20px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <h3 style={{ marginBottom: '15px', color: '#059669' }}>Visualisasi Data</h3>
        <div style={{ height: '400px' }}>
          <canvas id="researchChart"></canvas>
        </div>
        {React.useEffect(() => {
          const ctx = document.getElementById('researchChart');
          if (!ctx) return;
      
          // Generate gradients for bars
          const ctx2d = ctx.getContext('2d');
          const gradients = treatmentData.map(() => {
            const gradient = ctx2d.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, '#10b981');
            gradient.addColorStop(1, '#059669');
            return gradient;
          });
      
          const chart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: treatmentData.map(d => d.treatment),
              datasets: [{
                label: 'Rata-rata',
                data: treatmentData.map(d => calculateMean(d.replications)),
                backgroundColor: gradients,
                borderColor: '#059669',
                borderWidth: 1,
                // barThickness: 40, // Hapus atau comment line ini
                barPercentage: 0.8, // Tambahkan ini - menggunakan 80% dari space yang tersedia
                categoryPercentage: 0.9, // Tambahkan ini - jarak antar kategori
                borderRadius: 4,
                // Tambahkan error bars dengan nilai standar deviasi
                errorBars: {
                  show: true,
                  color: 'rgba(0, 0, 0, 0.2)',
                  width: 2,
                  lineWidth: 2,
                  values: treatmentData.map(d => calculateStandardDeviation(d.replications))
                }
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
              },
              plugins: {
                legend: {
                  position: 'top',
                },
                title: {
                  display: true,
                  text: 'Rata-rata Nilai per Perlakuan',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const dataIndex = context.dataIndex;
                      const dataset = treatmentData[dataIndex];
                      const mean = calculateMean(dataset.replications);
                      const sd = calculateStandardDeviation(dataset.replications);
                      const cv = calculateCV(dataset.replications);
                      return [
                        `Rata-rata: ${mean.toFixed(2)}`,
                        `Standar Deviasi: ${sd.toFixed(2)}`,
                        `CV: ${cv.toFixed(2)}%`,
                        `Ulangan: ${dataset.replications.join(', ')}`
                      ];
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Nilai',
                    font: {
                      size: 14,
                      weight: 'bold'
                    }
                  },
                  grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: 'Perlakuan',
                    font: {
                      size: 14,
                      weight: 'bold'
                    }
                  },
                  grid: {
                    display: false
                  }
                }
              }
            }
          });
      
          return () => chart.destroy();
        }, [treatmentData])}
      </div>

      <div style={{ marginTop: '30px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <h3 style={{ marginBottom: '15px', color: '#059669' }}>Analisis Tabel</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa', textAlign: 'left' }}>Perlakuan</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Rata-rata</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Standar Deviasi</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Total</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>CV (%)</th>
            </tr>
          </thead>
          <tbody>
            {calculateStatistics().map((stat, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stat.treatment}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stat.mean.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stat.sd.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stat.sum.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stat.cv.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: '0.9em', color: '#666' }}>
          <p>* CV = Coefficient of Variation (Koefisien Keragaman)</p>
          <p>* Semakin kecil nilai CV, semakin seragam data penelitian</p>
        </div>
      </div>
      <div style={{ marginTop: '30px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <h3 style={{ marginBottom: '15px', color: '#059669' }}>Analisis Sidik Ragam (ANOVA)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Sumber Keragaman</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>db</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>JK</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>KT</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>F-hitung</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>F-tabel</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Signifikansi</th>
              </tr>
            </thead>
            <tbody>
              {calculateANOVA().sources.map((row, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.source}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.df}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.SS?.toFixed(2) || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.MS?.toFixed(2) || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.F_value?.toFixed(2) || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.F_table?.toFixed(2) || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.significance || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            * signifikan pada taraf 5% (P{'<'}0.05)<br/>
            ns = tidak signifikan
          </p>
        </div>
      </div>

      <div style={{ marginTop: '30px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <h3 style={{ marginBottom: '15px', color: '#059669' }}>Uji DMRT (Duncan Multiple Range Test)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Perlakuan</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Rata-rata</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Notasi</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Perbedaan Nyata</th>
              </tr>
            </thead>
            <tbody>
            {dmrtResults && dmrtResults.treatmentComparisons.map((row, index) => (
              <tr key={index}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.treatment}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.mean.toFixed(2)}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.grouping}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {row.significantComparisons.length > 0 
                  ? `Berbeda nyata dengan: ${row.significantComparisons.map(comp => comp.treatment2).join(', ')}` 
                  : 'Tidak berbeda nyata'}
              </td>
            </tr>
          ))}
            </tbody>
          </table>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            Nilai yang diikuti huruf yang sama menunjukkan tidak berbeda nyata pada uji DMRT taraf 5%
          </p>
          {dmrtResults && renderDMRTResults()}
        </div>
      </div>

      <div style={{ marginTop: '30px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <h3 style={{ marginBottom: '15px', color: '#059669' }}>Analisis AI</h3>
        
        {/* Progress Bar */}
        {isAiAnalyzing && (
          <div style={{ 
            width: '100%', 
            backgroundColor: '#e5e7eb', 
            borderRadius: '4px', 
            marginTop: '10px',
            marginBottom: '10px'
          }}>
      <div 
        style={{ 
          width: `${aiAnalysisProgress}%`, 
          height: '10px', 
          backgroundColor: '#10b981', 
          borderRadius: '4px',
          transition: 'width 0.5s ease-in-out'
        }}
      />
    </div>
  )}

      {/* Modify Existing Button */}
      <button 
        onClick={analyzeWithAI} 
        disabled={isAiAnalyzing}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: isAiAnalyzing ? '#a1a1aa' : '#059669', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          cursor: isAiAnalyzing ? 'not-allowed' : 'pointer',
          opacity: isAiAnalyzing ? 0.7 : 1
        }}
      >
        {isAiAnalyzing ? 'Sedang Menganalisis...' : 'Analisis dengan AI'}
      </button>

      {/* Existing AI Analysis Result Display */}
      {aiAnalysis && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f0fdf4', 
          borderRadius: '8px' 
        }}>
          <p>{aiAnalysis}</p>
        </div>
      )}
    </div>
    </div>
  );
}

// Komponen utama App
const App = () => {
  const [selectedComponent, setSelectedComponent] = React.useState(null);
  const [showLanding, setShowLanding] = React.useState(true);

  const handleComponentChange = (component) => {
    console.log('Changing component to:', component);
    setSelectedComponent(component);
  };

  const handleHomeClick = () => {
    setShowLanding(true);
    setSelectedComponent(null);
  };

  const handleEnterApp = () => {
    setShowLanding(false);
    setSelectedComponent('weather');
  };

  console.log('Current selected component:', selectedComponent);

  if (showLanding) {
    return (
      <div className="landing-container" style={{ 
        textAlign: 'center', 
        padding: '2rem', 
        backgroundColor: '#f9fafb', 
        borderRadius: '8px', 
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginTop: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', color: COLORS.primary }}>PLATFORM PETANI CERDAS INDONESIA</h1>
          <p style={{ fontSize: '1.2rem', color: COLORS.primary, marginBottom: '1rem' }}>Platform untuk analisa cerdas dan ilmiah dibidang pertanian</p>
          <div>
            <p style={{ 
              fontSize: '1.1rem', 
              color: COLORS.black, 
              marginBottom: '1.5rem',
              fontWeight: 'bold',
              borderTop: `2px solid ${COLORS.primary}`,
              borderBottom: `2px solid ${COLORS.primary}`,
              padding: '1rem',
              display: 'inline-block'
            }}>
              PENGEMBANG PLATFORM
            </p>
            <p style={{ fontSize: '1.1rem', color: COLORS.black, marginBottom: '1.5rem' }}>
              Laboratorium Teaching and Research Farm, Fakultas Pertanian, Universitas Jambi
            </p>
            <p style={{ fontSize: '1.1rem', color: COLORS.black, marginBottom: '2.5rem' }}>
              Tahun 2024
            </p>
          </div>
          <div style={{ marginTop: '1.5rem', marginBottom: '2.5rem' }}>
            <button 
              onClick={handleEnterApp} 
              style={{ 
                padding: '12px 30px',
                backgroundColor: COLORS.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                ':hover': {
                  backgroundColor: COLORS.secondary,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)'
                }
              }}
            >
              Masuk ke Platform
            </button>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '2rem', 
            flexWrap: 'wrap',
            marginBottom: '2rem'
          }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <img src="/images/image_fx_Analysis5.jpg" alt="Weather Analysis" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
              <p style={{ marginTop: '0.5rem', color: COLORS.dark, textAlign: 'left' }}>Analisis Musim Tanam</p>
              <p style={{ fontSize: '0.9rem', color: COLORS.gray, textAlign: 'left' }}>
                Platform ini menyediakan analisis cuaca terkini yang membantu petani dalam merencanakan aktivitas pertanian dengan lebih efisien, mengurangi risiko kerugian akibat cuaca yang tidak menentu.
              </p>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <img src="/images/image_fx_Analysis6.jpg" alt="Farming Analysis" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
              <p style={{ marginTop: '0.5rem', color: COLORS.dark, textAlign: 'left' }}>Analisis Usaha Tani</p>
              <p style={{ fontSize: '0.9rem', color: COLORS.gray, textAlign: 'left' }}>
                Dengan analisis usaha tani, petani mendapatkan wawasan mendalam tentang praktik terbaik yang dapat meningkatkan hasil panen dan efisiensi operasional pertanian.
              </p>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <img src="/images/image_fx_Smart3.jpg" alt="Pest Economic Analysis" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
              <p style={{ marginTop: '0.5rem', color: COLORS.dark, textAlign: 'left' }}>Analisis Hama</p>
              <p style={{ fontSize: '0.9rem', color: COLORS.gray, textAlign: 'left' }}>
                Analisis ambang ekonomi hama memberikan informasi penting tentang kapan waktu yang tepat untuk melakukan tindakan pengendalian hama berdasarkan kepadatan populasi hama dan biaya pengendalian.
              </p>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <img src="/images/image_fx_Analysis1.jpg" alt="Research Analysis" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
              <p style={{ marginTop: '0.5rem', color: COLORS.dark, textAlign: 'left' }}>Analisa Penelitian</p>
              <p style={{ fontSize: '0.9rem', color: COLORS.gray, textAlign: 'left' }}>
                Analisa penelitian memberikan wawasan tentang efektivitas berbagai perlakuan dalam percobaan pertanian, membantu dalam pengambilan keputusan berbasis data.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav style={{ 
        backgroundColor: COLORS.primary,
        padding: '1rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <button 
            onClick={handleHomeClick}
            style={{
              backgroundColor: 'white',
              color: COLORS.primary,
              border: 'none',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              ':hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)',
                backgroundColor: '#f8fafc'
              }
            }}
            title="Kembali ke Beranda"
          >
            <i className="fas fa-home" style={{ fontSize: '1.25rem' }}></i>
          </button>

          <div style={{ 
            display: 'flex', 
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => handleComponentChange('weather')} 
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: selectedComponent === 'weather' ? 'white' : 'transparent',
                color: selectedComponent === 'weather' ? COLORS.primary : 'white',
                border: '1px solid white',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Analisa Musim Tanam
            </button>
            <button 
              onClick={() => handleComponentChange('farming')} 
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: selectedComponent === 'farming' ? 'white' : 'transparent',
                color: selectedComponent === 'farming' ? COLORS.primary : 'white',
                border: '1px solid white',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Analisis Usaha Tani
            </button>
            <button 
              onClick={() => handleComponentChange('pest')} 
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: selectedComponent === 'pest' ? 'white' : 'transparent',
                color: selectedComponent === 'pest' ? COLORS.primary : 'white',
                border: '1px solid white',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Analisis Hama
            </button>
            <button 
              onClick={() => handleComponentChange('research')} 
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: selectedComponent === 'research' ? 'white' : 'transparent',
                color: selectedComponent === 'research' ? COLORS.primary : 'white',
                border: '1px solid white',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Analisa Penelitian
            </button>
          </div>
        </div>
      </nav>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        padding: '20px' 
      }}>
        {selectedComponent === 'weather' && <WeatherCharts />}
        {selectedComponent === 'farming' && <FarmingAnalysis />}
        {selectedComponent === 'pest' && <PestEconomicAnalysis />}
        {selectedComponent === 'research' && <ResearchAnalysis />}
      </div>
    </div>
  );
}

export default App;
