import { GiphyFetch } from '@giphy/js-fetch-api';

const gf = new GiphyFetch(process.env.GIPHY_API_KEY || 'kUwzEHJq6BQ6lUb49xfvN7dFNRT9AcVw');

export async function searchGif(query: string): Promise<string | null> {
  try {
    const { data } = await gf.search(query, { limit: 5, rating: 'pg-13' });
    if (data.length === 0) return null;

    // Pick a random one from top 5 for variety
    const randomIndex = Math.floor(Math.random() * Math.min(5, data.length));
    const gif = data[randomIndex];

    // Return the downsized version for faster loading
    return gif.images.downsized_medium?.url || gif.images.original?.url || null;
  } catch (error) {
    console.error('[GIPHY] Search failed:', error);
    return null;
  }
}

export async function getRandomGif(tag?: string): Promise<string | null> {
  try {
    const { data } = await gf.random({ tag, rating: 'pg-13' });
    return data.images.downsized_medium?.url || data.images.original?.url || null;
  } catch (error) {
    console.error('[GIPHY] Random failed:', error);
    return null;
  }
}
