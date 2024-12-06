// Data tanaman
const CROPS = [
  {
    name: "Singkong",
    optimalTemperature: { min: 25, max: 29 },
    waterRequirement: { min: 150, max: 200 },
    growthPeriod: { min: 8, max: 12 },
    bestPlantingMonths: ["April", "Mei", "Juni"],
    soilType: "Tanah gembur, berdrainase baik",
    challenges: "Rentan terhadap hama kutu putih"
  },
  {
    name: "Jagung",
    optimalTemperature: { min: 23, max: 30 },
    waterRequirement: { min: 100, max: 180 },
    bestPlantingMonths: ["Maret", "April", "Oktober"],
    soilType: "Tanah lempung berpasir",
    challenges: "Membutuhkan pemupukan intensif"
  },
  {
    name: "Padi",
    optimalTemperature: { min: 22, max: 28 },
    waterRequirement: { min: 200, max: 300 },
    bestPlantingMonths: ["November", "Desember", "Januari"],
    soilType: "Tanah berlumpur",
    challenges: "Membutuhkan pengairan yang baik"
  }
];

// Data cuaca kota
const CITIES = {
  "Jambi": {
    monthlyWeather: [
      {
        month: "Januari",
        temperature_min: 23,
        temperature_max: 31,
        precipitation: 250,
        season: "Hujan"
      },
      {
        month: "Februari",
        temperature_min: 23,
        temperature_max: 32,
        precipitation: 220,
        season: "Hujan"
      },
      {
        month: "Maret",
        temperature_min: 24,
        temperature_max: 32,
        precipitation: 240,
        season: "Hujan"
      },
      {
        month: "April",
        temperature_min: 24,
        temperature_max: 33,
        precipitation: 180,
        season: "Peralihan"
      },
      {
        month: "Mei",
        temperature_min: 24,
        temperature_max: 33,
        precipitation: 150,
        season: "Kemarau"
      },
      {
        month: "Juni",
        temperature_min: 23,
        temperature_max: 32,
        precipitation: 120,
        season: "Kemarau"
      },
      {
        month: "Juli",
        temperature_min: 23,
        temperature_max: 32,
        precipitation: 100,
        season: "Kemarau"
      },
      {
        month: "Agustus",
        temperature_min: 23,
        temperature_max: 32,
        precipitation: 90,
        season: "Kemarau"
      },
      {
        month: "September",
        temperature_min: 23,
        temperature_max: 33,
        precipitation: 110,
        season: "Kemarau"
      },
      {
        month: "Oktober",
        temperature_min: 24,
        temperature_max: 33,
        precipitation: 150,
        season: "Peralihan"
      },
      {
        month: "November",
        temperature_min: 24,
        temperature_max: 32,
        precipitation: 200,
        season: "Hujan"
      },
      {
        month: "Desember",
        temperature_min: 23,
        temperature_max: 31,
        precipitation: 230,
        season: "Hujan"
      }
    ]
  }
};

export { CROPS, CITIES };
