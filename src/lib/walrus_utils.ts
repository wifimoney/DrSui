export async function walrusImageUrl(blobId: string, imageFileName: string) {
    try {
      const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
      const directUrl = `${AGGREGATOR}/v1/blobs/by-quilt-id/${blobId}/${imageFileName}`;
      console.log('Fetching image from Walrus aggregator:', directUrl);
      
      const res = await fetch(directUrl);
      if (!res.ok) {
        console.error(`Failed to fetch image: HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}`);
      }
      console.log('Response:', res);
      const imageBlob = await res.blob();
      const blobUrl = URL.createObjectURL(imageBlob);
      console.log('Created blob URL:', blobUrl);
      console.log('Direct Walrus URL (shareable):', directUrl);
      
      // Return both URLs - use directUrl for shareable links, blobUrl for display
      return {
        blobUrl,        // For <img> src (better performance, cached in browser)
        directUrl,      // For sharing/downloading (permanent link)
      };
    } catch (error) {
      console.error('Error fetching image from Walrus:', error);
      throw error;
    }
  }