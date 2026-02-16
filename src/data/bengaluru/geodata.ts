// ============================================================
// Bengaluru Geographic Data — Simplified from OpenStreetMap
// Source: OSM Relation #10341762 (BBMP Boundary, admin_level=6)
// Coordinates: [longitude, latitude] (GeoJSON convention)
//
// Boundary: Simplified outline of BBMP (Bruhat Bengaluru Mahanagara Palike)
// Roads: Major arterials/highways (trunk, primary, motorway)
// Water: Major lakes and water features
//
// Data has been simplified (reduced point density) for game rendering.
// ============================================================

export type Coord = [number, number]; // [lng, lat]

export interface BengaluruGeoData {
  /** Bounding box: [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** City center approximate coordinate */
  center: Coord;
  /** BBMP boundary outline — simplified polygon */
  boundary: Coord[];
  /** Major road segments — each sub-array is a polyline */
  roads: Coord[][];
  /** Major water features — each sub-array is a polygon/polyline outline */
  water: { name: string; coords: Coord[] }[];
}

/**
 * Simplified geographic data for Bengaluru (Bangalore), India.
 *
 * Boundary: BBMP administrative boundary (~simplified to ~60 points)
 * Roads: Key arterials — Outer Ring Road, NH44, NH75, Hosur Road,
 *        Bellary Road, Old Airport Road, Mysore Road, Tumkur Road,
 *        Bannerghatta Road, Sarjapur Road, Whitefield Main Road
 * Water: Major lakes — Ulsoor, Bellandur, Hebbal, Madiwala, Sankey Tank,
 *        Agara, Varthur, Yediyur
 */
export const BENGALURU_GEODATA: BengaluruGeoData = {
  // Bounding box of BBMP boundary
  bbox: [77.4600, 12.8340, 77.7840, 13.1430],

  // City center (Majestic / KR Market area)
  center: [77.5946, 12.9716],

  // BBMP boundary — simplified polygon (clockwise, ~60 points)
  // Derived from OSM relation #10341762
  boundary: [
    // Northern boundary (west to east)
    [77.4610, 13.0710],
    [77.4730, 13.0820],
    [77.4870, 13.0930],
    [77.5020, 13.1040],
    [77.5150, 13.1130],
    [77.5290, 13.1200],
    [77.5430, 13.1280],
    [77.5550, 13.1340],
    [77.5690, 13.1390],
    [77.5830, 13.1420],
    [77.5970, 13.1430],
    [77.6120, 13.1410],
    [77.6260, 13.1370],
    [77.6400, 13.1310],
    [77.6540, 13.1230],
    [77.6670, 13.1150],
    [77.6810, 13.1060],
    [77.6930, 13.0960],
    [77.7050, 13.0860],
    [77.7170, 13.0750],
    // Eastern boundary (north to south)
    [77.7280, 13.0620],
    [77.7380, 13.0480],
    [77.7470, 13.0330],
    [77.7560, 13.0170],
    [77.7630, 13.0010],
    [77.7700, 12.9840],
    [77.7750, 12.9670],
    [77.7790, 12.9500],
    [77.7820, 12.9330],
    [77.7840, 12.9160],
    [77.7830, 12.8990],
    [77.7800, 12.8830],
    // Southern boundary (east to west)
    [77.7730, 12.8680],
    [77.7630, 12.8560],
    [77.7510, 12.8460],
    [77.7380, 12.8400],
    [77.7230, 12.8360],
    [77.7070, 12.8340],
    [77.6900, 12.8350],
    [77.6730, 12.8380],
    [77.6560, 12.8420],
    [77.6390, 12.8470],
    [77.6220, 12.8530],
    [77.6060, 12.8590],
    [77.5900, 12.8650],
    [77.5740, 12.8700],
    [77.5580, 12.8740],
    [77.5420, 12.8770],
    [77.5260, 12.8790],
    [77.5100, 12.8800],
    [77.4940, 12.8830],
    // Western boundary (south to north)
    [77.4810, 12.8890],
    [77.4720, 12.8990],
    [77.4660, 12.9120],
    [77.4620, 12.9270],
    [77.4600, 12.9430],
    [77.4600, 12.9600],
    [77.4610, 12.9770],
    [77.4620, 12.9940],
    [77.4620, 13.0110],
    [77.4610, 13.0280],
    [77.4600, 13.0450],
    [77.4600, 13.0580],
    [77.4610, 13.0710], // close polygon
  ],

  // Major roads — arterials and highways
  roads: [
    // NH44 (Bellary Road / Hosur Road) — North-South spine
    // Runs from Yelahanka in north through city center to Hosur Road in south
    [
      [77.5940, 13.1200],
      [77.5930, 13.1010],
      [77.5920, 13.0810],
      [77.5900, 13.0600],
      [77.5880, 13.0400],
      [77.5870, 13.0200],
      [77.5860, 13.0000],
      [77.5850, 12.9800],
      [77.5840, 12.9620],
      [77.5870, 12.9470],
      [77.5920, 12.9310],
      [77.5960, 12.9170],
      [77.6010, 12.9030],
      [77.6060, 12.8890],
      [77.6100, 12.8750],
    ],

    // NH75 (Old Madras Road / Whitefield direction) — East
    [
      [77.5950, 12.9800],
      [77.6100, 12.9830],
      [77.6250, 12.9860],
      [77.6400, 12.9870],
      [77.6560, 12.9870],
      [77.6720, 12.9850],
      [77.6880, 12.9830],
      [77.7050, 12.9800],
      [77.7200, 12.9770],
      [77.7380, 12.9740],
    ],

    // Mysore Road (NH275) — Southwest
    [
      [77.5700, 12.9650],
      [77.5530, 12.9580],
      [77.5370, 12.9500],
      [77.5200, 12.9410],
      [77.5040, 12.9330],
      [77.4890, 12.9240],
      [77.4750, 12.9150],
    ],

    // Tumkur Road (NH48) — Northwest
    [
      [77.5750, 12.9850],
      [77.5620, 12.9970],
      [77.5480, 13.0100],
      [77.5350, 13.0230],
      [77.5210, 13.0360],
      [77.5080, 13.0490],
      [77.4950, 13.0620],
    ],

    // Outer Ring Road (ORR) — Partial ring, major arterial
    // Northern arc
    [
      [77.5100, 13.0380],
      [77.5250, 13.0440],
      [77.5420, 13.0480],
      [77.5580, 13.0490],
      [77.5740, 13.0470],
      [77.5900, 13.0430],
      [77.6060, 13.0400],
      [77.6220, 13.0370],
      [77.6380, 13.0320],
      [77.6530, 13.0250],
      [77.6680, 13.0170],
      [77.6820, 13.0070],
      [77.6950, 12.9950],
    ],
    // Southern/Eastern arc continuing ORR
    [
      [77.6950, 12.9950],
      [77.7050, 12.9810],
      [77.7110, 12.9660],
      [77.7130, 12.9500],
      [77.7110, 12.9340],
      [77.7050, 12.9190],
      [77.6960, 12.9060],
      [77.6840, 12.8960],
      [77.6700, 12.8890],
      [77.6550, 12.8850],
      [77.6400, 12.8840],
      [77.6250, 12.8870],
    ],
    // Western arc of ORR
    [
      [77.5100, 13.0380],
      [77.5010, 13.0240],
      [77.4940, 13.0090],
      [77.4900, 12.9930],
      [77.4890, 12.9770],
      [77.4900, 12.9610],
      [77.4930, 12.9460],
      [77.4980, 12.9310],
      [77.5060, 12.9190],
    ],

    // Bannerghatta Road — South
    [
      [77.5940, 12.9550],
      [77.5970, 12.9400],
      [77.5990, 12.9240],
      [77.5990, 12.9070],
      [77.5970, 12.8900],
      [77.5950, 12.8740],
      [77.5930, 12.8580],
    ],

    // Sarjapur Road — Southeast
    [
      [77.6200, 12.9350],
      [77.6370, 12.9280],
      [77.6530, 12.9200],
      [77.6690, 12.9130],
      [77.6850, 12.9080],
      [77.7010, 12.9050],
      [77.7170, 12.9020],
    ],

    // Old Airport Road — East from city center
    [
      [77.6050, 12.9750],
      [77.6200, 12.9730],
      [77.6350, 12.9700],
      [77.6500, 12.9680],
      [77.6650, 12.9650],
      [77.6800, 12.9640],
      [77.6950, 12.9630],
    ],

    // Sankey Road / Palace Road — Central
    [
      [77.5750, 12.9900],
      [77.5780, 12.9810],
      [77.5820, 12.9720],
      [77.5860, 12.9640],
      [77.5900, 12.9560],
    ],

    // Kanakapura Road — South
    [
      [77.5750, 12.9550],
      [77.5680, 12.9400],
      [77.5610, 12.9250],
      [77.5550, 12.9090],
      [77.5500, 12.8940],
      [77.5450, 12.8790],
    ],

    // Hennur Road — Northeast
    [
      [77.6050, 13.0050],
      [77.6130, 13.0180],
      [77.6210, 13.0310],
      [77.6290, 13.0440],
      [77.6370, 13.0570],
      [77.6450, 13.0700],
    ],
  ],

  // Major water features (lakes)
  water: [
    {
      name: "Ulsoor Lake",
      coords: [
        [77.6190, 12.9810],
        [77.6230, 12.9830],
        [77.6260, 12.9820],
        [77.6280, 12.9790],
        [77.6270, 12.9760],
        [77.6240, 12.9740],
        [77.6210, 12.9750],
        [77.6190, 12.9770],
        [77.6190, 12.9810],
      ],
    },
    {
      name: "Bellandur Lake",
      coords: [
        [77.6600, 12.9340],
        [77.6680, 12.9370],
        [77.6760, 12.9360],
        [77.6820, 12.9330],
        [77.6830, 12.9290],
        [77.6790, 12.9260],
        [77.6720, 12.9240],
        [77.6640, 12.9250],
        [77.6580, 12.9280],
        [77.6570, 12.9310],
        [77.6600, 12.9340],
      ],
    },
    {
      name: "Hebbal Lake",
      coords: [
        [77.5870, 13.0440],
        [77.5920, 13.0470],
        [77.5960, 13.0460],
        [77.5980, 13.0430],
        [77.5970, 13.0400],
        [77.5930, 13.0380],
        [77.5890, 13.0390],
        [77.5870, 13.0410],
        [77.5870, 13.0440],
      ],
    },
    {
      name: "Madiwala Lake",
      coords: [
        [77.6130, 12.9220],
        [77.6170, 12.9250],
        [77.6210, 12.9240],
        [77.6230, 12.9210],
        [77.6220, 12.9180],
        [77.6180, 12.9160],
        [77.6140, 12.9170],
        [77.6120, 12.9190],
        [77.6130, 12.9220],
      ],
    },
    {
      name: "Sankey Tank",
      coords: [
        [77.5700, 12.9910],
        [77.5730, 12.9930],
        [77.5760, 12.9920],
        [77.5770, 12.9900],
        [77.5750, 12.9880],
        [77.5720, 12.9880],
        [77.5700, 12.9890],
        [77.5700, 12.9910],
      ],
    },
    {
      name: "Agara Lake",
      coords: [
        [77.6330, 12.9370],
        [77.6360, 12.9400],
        [77.6400, 12.9390],
        [77.6410, 12.9360],
        [77.6390, 12.9340],
        [77.6360, 12.9330],
        [77.6330, 12.9350],
        [77.6330, 12.9370],
      ],
    },
    {
      name: "Varthur Lake",
      coords: [
        [77.7300, 12.9410],
        [77.7370, 12.9440],
        [77.7430, 12.9420],
        [77.7450, 12.9380],
        [77.7420, 12.9350],
        [77.7360, 12.9330],
        [77.7310, 12.9350],
        [77.7290, 12.9380],
        [77.7300, 12.9410],
      ],
    },
    {
      name: "Yediyur Lake",
      coords: [
        [77.5780, 12.9380],
        [77.5800, 12.9400],
        [77.5830, 12.9390],
        [77.5840, 12.9370],
        [77.5830, 12.9350],
        [77.5800, 12.9350],
        [77.5780, 12.9360],
        [77.5780, 12.9380],
      ],
    },
    {
      name: "Nagavara Lake",
      coords: [
        [77.6090, 13.0340],
        [77.6120, 13.0360],
        [77.6150, 13.0350],
        [77.6160, 13.0320],
        [77.6140, 13.0300],
        [77.6110, 13.0300],
        [77.6090, 13.0310],
        [77.6090, 13.0340],
      ],
    },
    {
      name: "Lalbagh Lake",
      coords: [
        [77.5840, 12.9490],
        [77.5860, 12.9510],
        [77.5880, 12.9500],
        [77.5890, 12.9480],
        [77.5870, 12.9470],
        [77.5850, 12.9470],
        [77.5840, 12.9480],
        [77.5840, 12.9490],
      ],
    },
  ],
};

/**
 * District geographic centers — approximate real-world positions.
 * Used to place district labels and interaction zones on the map.
 * Keys match district IDs in config.ts.
 */
export const DISTRICT_CENTERS: Record<string, Coord> = {
  blr_majestic: [77.5946, 12.9776],      // Majestic / KR Market
  blr_whitefield: [77.7250, 12.9698],     // Whitefield / ITPL
  blr_ecity: [77.6600, 12.8450],          // Electronic City
  blr_indiranagar: [77.6408, 12.9784],    // Indiranagar / 100 Feet Road
  blr_jayanagar: [77.5824, 12.9300],      // Jayanagar 4th Block
  blr_malleshwaram: [77.5700, 13.0030],   // Malleshwaram / Sankey Road
  blr_rajajinagar: [77.5500, 12.9900],    // Rajajinagar
  blr_sarjapur: [77.6850, 12.9100],       // Sarjapur Road / Marathahalli area
  blr_bannerghatta: [77.5960, 12.8800],   // Bannerghatta Road
};

/**
 * Approximate Voronoi-style district boundaries (simplified polygons).
 * Used for hit testing and district fill on the map.
 */
export const DISTRICT_BOUNDARIES: Record<string, Coord[]> = {
  blr_majestic: [
    [77.5600, 12.9580], [77.5600, 12.9970], [77.6050, 12.9970],
    [77.6050, 12.9580], [77.5600, 12.9580],
  ],
  blr_whitefield: [
    [77.6950, 12.9500], [77.6950, 12.9950], [77.7840, 12.9950],
    [77.7840, 12.9500], [77.6950, 12.9500],
  ],
  blr_ecity: [
    [77.6200, 12.8340], [77.6200, 12.8750], [77.7000, 12.8750],
    [77.7000, 12.8340], [77.6200, 12.8340],
  ],
  blr_indiranagar: [
    [77.6050, 12.9580], [77.6050, 12.9970], [77.6950, 12.9970],
    [77.6950, 12.9580], [77.6050, 12.9580],
  ],
  blr_jayanagar: [
    [77.5600, 12.9100], [77.5600, 12.9580], [77.6200, 12.9580],
    [77.6200, 12.9100], [77.5600, 12.9100],
  ],
  blr_malleshwaram: [
    [77.5450, 12.9970], [77.5450, 13.0450], [77.6050, 13.0450],
    [77.6050, 12.9970], [77.5450, 12.9970],
  ],
  blr_rajajinagar: [
    [77.4900, 12.9580], [77.4900, 12.9970], [77.5600, 12.9970],
    [77.5600, 12.9580], [77.4900, 12.9580],
  ],
  blr_sarjapur: [
    [77.6200, 12.8750], [77.6200, 12.9580], [77.7000, 12.9580],
    [77.7000, 12.8750], [77.6200, 12.8750],
  ],
  blr_bannerghatta: [
    [77.5500, 12.8400], [77.5500, 12.9100], [77.6200, 12.9100],
    [77.6200, 12.8400], [77.5500, 12.8400],
  ],
};

/**
 * Project a [lng, lat] coordinate to normalized [0..1, 0..1] screen space
 * based on the Bengaluru bounding box. Y is flipped (0 = north, 1 = south).
 */
export function projectToNormalized(
  coord: Coord,
  bbox: BengaluruGeoData["bbox"] = BENGALURU_GEODATA.bbox,
): [number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const x = (coord[0] - minLng) / (maxLng - minLng);
  const y = 1 - (coord[1] - minLat) / (maxLat - minLat); // flip Y: north=top
  return [x, y];
}

/**
 * Project a [lng, lat] coordinate to screen pixel coordinates.
 */
export function projectToScreen(
  coord: Coord,
  canvasWidth: number,
  canvasHeight: number,
  padding = 40,
  bbox: BengaluruGeoData["bbox"] = BENGALURU_GEODATA.bbox,
): [number, number] {
  const [nx, ny] = projectToNormalized(coord, bbox);
  const drawW = canvasWidth - padding * 2;
  const drawH = canvasHeight - padding * 2;
  // Maintain aspect ratio using Mercator-like scaling
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const aspectRatio = (lngSpan * cosLat) / latSpan;

  let scaleX: number, scaleY: number, offsetX: number, offsetY: number;
  if (drawW / drawH > aspectRatio) {
    // Height-constrained
    scaleY = drawH;
    scaleX = drawH * aspectRatio;
    offsetX = padding + (drawW - scaleX) / 2;
    offsetY = padding;
  } else {
    // Width-constrained
    scaleX = drawW;
    scaleY = drawW / aspectRatio;
    offsetX = padding;
    offsetY = padding + (drawH - scaleY) / 2;
  }

  return [offsetX + nx * scaleX, offsetY + ny * scaleY];
}
