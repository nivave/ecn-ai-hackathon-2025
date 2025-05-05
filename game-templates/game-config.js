// game-config.js - Shared configuration for all games

// Extract topic parameter from URL
function getTopicFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const topic = urlParams.get('topic') || 'default';
  return topic;
}

// Configure asset URLs based on topic
function configureGameAssets() {
  const topic = getTopicFromUrl();
  const baseUrl =
    'https://raw.githubusercontent.com/nivave/ecn-ai-hackathon-2025/main/game-assets';

  // Create URLs with fallbacks to local assets
  return {
    character: `${baseUrl}/${topic}/character.png`,
    item: `${baseUrl}/${topic}/item.png`,
    background: `${baseUrl}/${topic}/background.png`,
    topic: topic,
  };
}

// Enhanced image loader with fallback
function loadImageWithFallback(src, fallbackSrc) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}, trying fallback`);
      // If fallback is provided, try it
      if (fallbackSrc) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => {
          console.error(`Failed to load fallback image: ${fallbackSrc}`);
          // Return a 1x1 transparent placeholder
          const placeholder = new Image(1, 1);
          placeholder.src =
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          resolve(placeholder);
        };
        fallbackImg.src = fallbackSrc;
      } else {
        // No fallback, return placeholder
        const placeholder = new Image(1, 1);
        placeholder.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        resolve(placeholder);
      }
    };
    img.src = src;
  });
}

// Get game assets
const GAME_ASSETS = configureGameAssets();
