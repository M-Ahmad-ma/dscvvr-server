require("dotenv").config();
const pool = require("./pool");

const products = [
  // Headphones
  { name: "Sony WH-1000XM5", category: "Headphones", description: "Industry-leading noise cancelling with exceptional sound quality and comfort" },
  { name: "AirPods Max", category: "Headphones", description: "Apple's premium over-ear headphones with spatial audio" },
  { name: "Bose QuietComfort 45", category: "Headphones", description: "Comfortable noise-cancelling headphones for everyday use" },
  { name: "Sennheiser Momentum 4", category: "Headphones", description: "Audiophile-grade sound with modern features" },

  // Laptops
  { name: "MacBook Pro 16\"", category: "Laptops", description: "Apple's powerhouse laptop for professionals" },
  { name: "Dell XPS 15", category: "Laptops", description: "Premium Windows laptop with InfinityEdge display" },
  { name: "ThinkPad X1 Carbon", category: "Laptops", description: "Business ultrabook with legendary keyboard" },
  { name: "ASUS ROG Zephyrus", category: "Laptops", description: "Gaming laptop with top-tier performance" },

  // Keyboards
  { name: "Keychron K2", category: "Keyboards", description: "Wireless mechanical keyboard with hot-swappable switches" },
  { name: "Logitech MX Keys", category: "Keyboards", description: "Premium wireless keyboard for productivity" },
  { name: "Razer Huntsman V3", category: "Keyboards", description: "Gaming keyboard with analog optical switches" },
  { name: "HHKB Professional HYBRID", category: "Keyboards", description: "Legendary Topre keyboard with Bluetooth" },

  // Phones
  { name: "iPhone 16 Pro", category: "Phones", description: "Apple's latest flagship with A18 Pro chip" },
  { name: "Samsung Galaxy S25 Ultra", category: "Phones", description: "Samsung's premium phone with S Pen" },
  { name: "Google Pixel 9 Pro", category: "Phones", description: "Pure Android with best-in-class camera" },
  { name: "OnePlus 13", category: "Phones", description: "Flagship killer with Hasselblad camera" },

  // Cameras
  { name: "Sony A7 IV", category: "Cameras", description: "Full-frame mirrorless for hybrid shooters" },
  { name: "Canon R5 Mark II", category: "Cameras", description: "High-resolution full-frame mirrorless" },
  { name: "Fujifilm X-T5", category: "Cameras", description: "Retro-styled APS-C mirrorless with stunning colors" },
  { name: "DJI Osmo Pocket 3", category: "Cameras", description: "Compact gimbal camera for vlogging" },

  // Wearables
  { name: "Apple Watch Ultra 2", category: "Wearables", description: "Rugged smartwatch for extreme adventures" },
  { name: "Samsung Galaxy Watch 7", category: "Wearables", description: "Wear OS smartwatch with health tracking" },
  { name: "Whoop 4.0", category: "Wearables", description: "Screen-free fitness and recovery tracker" },
  { name: "Oura Ring Gen 3", category: "Wearables", description: "Smart ring for sleep and health tracking" },

  // Gaming
  { name: "PS5 Pro", category: "Gaming", description: "Sony's enhanced PlayStation console" },
  { name: "Xbox Series X", category: "Gaming", description: "Microsoft's most powerful console" },
  { name: "Nintendo Switch 2", category: "Gaming", description: "Nintendo's next-gen hybrid console" },
  { name: "Steam Deck OLED", category: "Gaming", description: "Handheld PC gaming with stunning OLED display" },

  // Audio
  { name: "Sonos Era 300", category: "Audio", description: "Spatial audio smart speaker" },
  { name: "Bose SoundLink Max", category: "Audio", description: "Portable Bluetooth speaker with deep bass" },
  { name: "KEF LS50 Wireless II", category: "Audio", description: "Audiophile bookshelf speakers" },
  { name: "Marshall Stanmore III", category: "Audio", description: "Classic design meets modern sound" },

  // Tablets
  { name: "iPad Pro 12.9\"", category: "Tablets", description: "Apple's most powerful tablet with M4 chip" },
  { name: "Samsung Galaxy Tab S10", category: "Tablets", description: "Premium Android tablet with S Pen" },
  { name: "iPad Air M2", category: "Tablets", description: "Versatile tablet for everyday use" },
  { name: "Remarkable 2", category: "Tablets", description: "E-ink tablet for writing and note-taking" },

  // Monitors
  { name: "LG UltraGear 27GP950", category: "Monitors", description: "4K 144Hz gaming monitor" },
  { name: "Dell U2723QE", category: "Monitors", description: "4K USB-C monitor for productivity" },
  { name: "Samsung Odyssey G9", category: "Monitors", description: "49-inch super ultrawide gaming monitor" },
  { name: "Apple Studio Display", category: "Monitors", description: "5KRetina display for Mac users" },

  // Mice
  { name: "Logitech MX Master 3S", category: "Mice", description: "Ergonomic wireless mouse for productivity" },
  { name: "Razer DeathAdder V3", category: "Mice", description: "Lightweight ergonomic gaming mouse" },
  { name: "Apple Magic Mouse", category: "Mice", description: "Multi-touch gesture support" },
  { name: "Logitech G Pro X Superlight", category: "Mice", description: "Ultra-lightweight wireless gaming mouse" },

  // Speakers
  { name: "Sonos Era 100", category: "Speakers", description: "Compact smart speaker with great sound" },
  { name: "JBL Charge 5", category: "Speakers", description: "Portable speaker with powerbank function" },
  { name: "Apple HomePod", category: "Speakers", description: "Room-filling sound with Siri" },
  { name: "Bang & Olufsen Beosound A5", category: "Speakers", description: "Premium portable speaker" },

  // Accessories
  { name: "Anker 737 Power Bank", category: "Accessories", description: "24,000mAh portable charger with 140W output" },
  { name: "Twelve South MagSafe Charger", category: "Accessories", description: "Wireless charging stand for iPhone" },
  { name: "CalDigit TS4 Dock", category: "Accessories", description: "18-port Thunderbolt 4 dock" },
  { name: "Nomad Leather Case", category: "Accessories", description: "Premium leather case for iPhone" },

  // Networking
  { name: "Ubiquiti Dream Router", category: "Networking", description: "WiFi 6 mesh router with network management" },
  { name: "ASUS RT-BE96U", category: "Networking", description: "WiFi 7 flagship router" },
  { name: "Netgear Nighthawk RAXE500", category: "Networking", description: "Tri-band WiFi 6E router" },
  { name: "Google Nest WiFi Pro", category: "Networking", description: "Mesh WiFi with Matter support" },

  // Smart Home
  { name: "Philips Hue Starter Kit", category: "Smart Home", description: "Smart lighting with bridge and bulbs" },
  { name: "Ecobee Smart Thermostat", category: "Smart Home", description: "AI-powered home climate control" },
  { name: "Ring Video Doorbell Pro 2", category: "Smart Home", description: "Video doorbell with 3D motion detection" },
  { name: "August Smart Lock Pro", category: "Smart Home", description: "Smart deadbolt with auto-lock" },

  // Chargers
  { name: "Anker Nano II 65W", category: "Chargers", description: "Compact GaN charger for laptops and phones" },
  { name: "Belkin 3-in-1 MagSafe", category: "Chargers", description: "Charging station for iPhone, Watch, AirPods" },
  { name: "Apple 140W USB-C", category: "Chargers", description: "Fast charger for MacBook Pro" },
  { name: "Ugreen Nexode 100W", category: "Chargers", description: "Multi-port GaN charger" },

  // Cases
  { name: "OtterBox Defender", category: "Cases", description: "Heavy-duty protection for iPhone" },
  { name: "Casetify Impact", category: "Cases", description: "Stylish and protective phone case" },
  { name: "Peak Design Everyday", category: "Cases", description: "Premium camera bag and case" },
  { name: "Spigen Tough Armor", category: "Cases", description: "Rugged case with kickstand" },

  // Cables
  { name: "Anker PowerLine III", category: "Cables", description: "Durable USB-C to USB-C cable" },
  { name: "Belkin UltraFast HDMI", category: "Cables", description: "48Gbps HDMI 2.1 cable" },
  { name: "Apple Thunderbolt 4", category: "Cables", description: "Thunderbolt 4 Pro cable" },
  { name: "Nomad USB-C 100W", category: "Cables", description: "Braided USB-C cable with Kevlar" },

  // Storage
  { name: "Samsung T9 Portable SSD", category: "Storage", description: "2000MB/s portable SSD" },
  { name: "WD Black SN850X", category: "Storage", description: "NVMe SSD for gaming" },
  { name: "LaCie Rugged SSD", category: "Storage", description: "Shock-resistant portable SSD" },
  { name: "SanDisk Extreme Pro", category: "Storage", description: "High-speed SD card for cameras" },

  // Printers
  { name: "HP LaserJet Pro", category: "Printers", description: "Mono laser printer for office" },
  { name: "Epson EcoTank ET-2850", category: "Printers", description: "Cartridge-free ink tank printer" },
  { name: "Canon PIXMA TR8620", category: "Printers", description: "All-in-one photo printer" },
  { name: "Brother HL-L2350DW", category: "Printers", description: "Compact mono laser printer" },
];

const userIds = [
  "eb5990d0-d067-4b31-be81-36f4cbac4059",
  "7333fb97-8cc3-4028-b7a8-8f6ee65fa841",
  "a5951ab9-4104-438d-8b95-cb5bb9f0c7f2",
  "c2dd1121-d1c5-40c0-87c4-ddc6d444d874",
  "85c4c8f3-9057-4ba4-bdfc-2a1add3a02f6",
];

const seed = async () => {
  try {
    let count = 0;
    for (const product of products) {
      const userId = userIds[count % userIds.length];
      await pool.query(
        `INSERT INTO products (user_id, name, description, category)
         VALUES ($1, $2, $3, $4)`,
        [userId, product.name, product.description, product.category]
      );
      count++;
    }
    console.log(`Seeded ${count} products`);
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await pool.end();
  }
};

seed();
