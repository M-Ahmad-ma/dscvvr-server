require("dotenv").config();
const pool = require("./pool");

const categories = [
  { name: "Headphones", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400", tagline: "Immerse yourself in sound" },
  { name: "Laptops", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400", tagline: "Power meets portability" },
  { name: "Keyboards", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400", tagline: "Type with precision" },
  { name: "Phones", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", tagline: "Connected everywhere" },
  { name: "Cameras", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400", tagline: "Capture every moment" },
  { name: "Wearables", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400", tagline: "Track your lifestyle" },
  { name: "Gaming", image: "https://images.unsplash.com/photo-1592840496694-26d035b52b48?w=400", tagline: "Level up your play" },
  { name: "Audio", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400", tagline: "Hear the difference" },
  { name: "Tablets", image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400", tagline: "Your canvas, anywhere" },
  { name: "Accessories", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400", tagline: "Complete your setup" },
  { name: "Monitors", image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400", tagline: "See the bigger picture" },
  { name: "Mice", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400", tagline: "Precision at your fingertips" },
  { name: "Speakers", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400", tagline: "Fill the room with sound" },
  { name: "Chargers", image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400", tagline: "Stay powered up" },
  { name: "Cases", image: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400", tagline: "Protect your devices" },
  { name: "Cables", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400", tagline: "Stay connected" },
  { name: "Storage", image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400", tagline: "Never run out of space" },
  { name: "Printers", image: "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400", tagline: "Bring your work to life" },
  { name: "Networking", image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400", tagline: "Stay online everywhere" },
  { name: "Smart Home", image: "https://images.unsplash.com/photo-1558002038-1055907df827?w=400", tagline: "Automate your life" },
];

const seed = async () => {
  try {
    for (const cat of categories) {
      await pool.query(
        `INSERT INTO categories (name, image, tagline)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET image = EXCLUDED.image, tagline = EXCLUDED.tagline`,
        [cat.name, cat.image, cat.tagline]
      );
    }
    console.log(`Seeded ${categories.length} categories`);
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await pool.end();
  }
};

seed();
