// game.js - Collect It (Snake-style) Game Template

// Utility to load images asynchronously
const loadImage = src =>
  new Promise((resolve, reject) => {
    if (!src) {
      // Resolve with a placeholder if no src is provided
      resolve(null);
      return;
    }
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = e => {
      console.warn(`Failed to load image: ${src}`, e);
      // Return a 1x1 transparent placeholder instead of rejecting
      const placeholder = new Image(1, 1);
      placeholder.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      resolve(placeholder);
    };
  });

// Main Game Class
class Game {
  constructor(canvasId, config) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.config = config;
    this.gridSize = { w: config.grid.width, h: config.grid.height };
    this.cellSize = { w: 0, h: 0 }; // Will be calculated dynamically
    // Canvas resolution is set in resizeAndCalculate

    this.character = null;
    this.item = null;
    this.backgroundImage = null;
    this.characterImage = null; // Head image
    this.itemImage = null; // Item image (also used for body)

    // Score tracking
    this.score = 0;
    this.highScore = 0;
    this.topic = GAME_ASSETS.topic || 'default';
    this.localStorageKey = `collectIt_highScore_${this.topic}`;

    this.gameOver = false;
    this.gameLoopInterval = null;
    this.gameSpeed = 200; // ms per update

    // Touch input state for SWIPES
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.swipeThreshold = 30;
  }

  // Improved resizeAndCalculate method with strict aspect ratio
  resizeAndCalculate() {
    // Get the container element
    const container = this.canvas.parentElement;

    // Get the available dimensions
    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight;

    // Calculate the grid aspect ratio (width:height)
    const gridAspectRatio = this.gridSize.w / this.gridSize.h;

    // Determine the largest size that fits in the container while maintaining aspect ratio
    let canvasWidth, canvasHeight;

    if (availableWidth / availableHeight > gridAspectRatio) {
      // Container is wider than needed - height is the limiting factor
      canvasHeight = availableHeight;
      canvasWidth = canvasHeight * gridAspectRatio;
    } else {
      // Container is taller than needed - width is the limiting factor
      canvasWidth = availableWidth;
      canvasHeight = canvasWidth / gridAspectRatio;
    }

    // Apply size to both CSS and canvas resolution
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    // Calculate cell size to ensure perfect square cells
    this.cellSize.w = canvasWidth / this.gridSize.w;
    this.cellSize.h = canvasHeight / this.gridSize.h;

    // Render the game if it's already started
    if (this.character) {
      this.render();
    }
  }

  async init() {
    try {
      // Load assets
      [this.characterImage, this.itemImage, this.backgroundImage] =
        await Promise.all([
          loadImage(this.config.character.imageSrc),
          loadImage(this.config.item.imageSrc),
          loadImage(this.config.background.imageSrc),
        ]);

      // Load high score from localStorage
      this.loadHighScore();

      // Setup game elements
      this.setup();
      this.addEventListeners();

      // Initial sizing (after setup, before game loop)
      this.resizeAndCalculate();

      // Handle window resize
      window.addEventListener('resize', this.handleResize.bind(this));

      // Start the game loop
      this.startGameLoop();
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }

  setup() {
    this.score = 0;
    this.gameOver = false;
    // Character now uses the dynamically calculated cellSize
    this.character = new Character(this.config, this.gridSize, this.cellSize);
    this.spawnItem();
  }

  addEventListeners() {
    // Listen for swipes on the CANVAS
    this.canvas.addEventListener(
      'touchstart',
      this.handleCanvasTouchStart.bind(this),
      { passive: false }
    );
    this.canvas.addEventListener(
      'touchend',
      this.handleCanvasTouchEnd.bind(this),
      {
        passive: false,
      }
    );

    // Listen for clicks/taps on the HTML BUTTONS
    document
      .getElementById('btn-up')
      .addEventListener('click', () => this.handleButtonClick({ x: 0, y: -1 }));
    document
      .getElementById('btn-down')
      .addEventListener('click', () => this.handleButtonClick({ x: 0, y: 1 }));
    document
      .getElementById('btn-left')
      .addEventListener('click', () => this.handleButtonClick({ x: -1, y: 0 }));
    document
      .getElementById('btn-right')
      .addEventListener('click', () => this.handleButtonClick({ x: 1, y: 0 }));

    // Optional: Keyboard controls for testing
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleButtonClick(direction) {
    if (!this.gameOver) {
      this.character.setDirection(direction);
    }
  }

  handleKeyDown(e) {
    if (this.gameOver && e.key === 'Enter') {
      this.restart();
      return;
    }
    if (this.gameOver) return;

    let newDirection = null;
    switch (e.key) {
      case 'ArrowUp':
        newDirection = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
        newDirection = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
        newDirection = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
        newDirection = { x: 1, y: 0 };
        break;
    }
    if (newDirection) {
      this.character.setDirection(newDirection);
    }
  }

  handleCanvasTouchStart(e) {
    e.preventDefault();
    if (this.gameOver) {
      this.restart(); // Restart on tap/swipe on canvas when game over
      return;
    }
    // Record start position for swipe detection
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  handleCanvasTouchEnd(e) {
    e.preventDefault();
    // Only process swipe if touchStartX/Y are set
    if (this.gameOver || this.touchStartX === 0) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - this.touchStartX;
    const dy = touchEndY - this.touchStartY;

    let newDirection = null;

    // Determine dominant swipe direction
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > this.swipeThreshold) {
        newDirection = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
      }
    } else {
      if (Math.abs(dy) > this.swipeThreshold) {
        newDirection = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
      }
    }

    if (newDirection) {
      this.character.setDirection(newDirection);
    }

    // Reset swipe start points after processing
    this.touchStartX = 0;
    this.touchStartY = 0;
  }

  startGameLoop() {
    clearInterval(this.gameLoopInterval); // Clear any existing loop
    this.gameLoopInterval = setInterval(() => {
      if (!this.gameOver) {
        this.update();
        this.render();
      }
    }, this.gameSpeed);
  }

  update() {
    if (!this.character.move()) {
      this.endGame(); // Collision detected
      return;
    }

    // Check for item collection
    const head = this.character.segments[0];
    if (head.x === this.item.x && head.y === this.item.y) {
      this.score++;
      this.character.grow();
      this.spawnItem();
    }
  }

  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background
    if (this.backgroundImage) {
      this.ctx.drawImage(
        this.backgroundImage,
        0,
        0,
        this.canvas.width, // Use current canvas size
        this.canvas.height
      );
    } else {
      this.ctx.fillStyle = '#eee'; // Fallback background
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw item (uses dynamic cellSize)
    this.item.draw(this.ctx, this.itemImage, this.cellSize);

    // Draw character (uses dynamic cellSize)
    this.character.draw(
      this.ctx,
      this.characterImage,
      this.itemImage,
      this.cellSize
    );

    // Draw score
    this.ctx.fillStyle = '#000';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Score: ${this.score}`, 10, 30);

    // Draw high score
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `High Score: ${this.highScore}`,
      this.canvas.width - 10,
      30
    );

    // Draw Game Over message
    if (this.gameOver) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = '#fff';
      this.ctx.font = '40px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        'Game Over',
        this.canvas.width / 2,
        this.canvas.height / 2 - 30
      );

      this.ctx.font = '24px Arial';
      this.ctx.fillText(
        `Score: ${this.score}`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 10
      );

      // Display high score in game over screen
      if (this.score >= this.highScore) {
        this.ctx.fillStyle = '#ffff00'; // Yellow for new high score
        this.ctx.fillText(
          `New High Score!`,
          this.canvas.width / 2,
          this.canvas.height / 2 + 40
        );
      } else {
        this.ctx.fillText(
          `High Score: ${this.highScore}`,
          this.canvas.width / 2,
          this.canvas.height / 2 + 40
        );
      }

      this.ctx.fillStyle = '#fff';
      this.ctx.font = '18px Arial';
      this.ctx.fillText(
        'Tap or Press Enter to Restart',
        this.canvas.width / 2,
        this.canvas.height / 2 + 70
      );
    }
  }

  spawnItem() {
    let newItemX, newItemY;
    let collision = true;
    // Keep trying until an empty cell is found
    while (collision) {
      newItemX = Math.floor(Math.random() * this.gridSize.w);
      newItemY = Math.floor(Math.random() * this.gridSize.h);
      collision = this.character.segments.some(
        segment => segment.x === newItemX && segment.y === newItemY
      );
    }
    this.item = new Item(this.config, newItemX, newItemY);
  }

  endGame() {
    this.gameOver = true;
    clearInterval(this.gameLoopInterval);
    this.saveHighScore();
    this.render(); // Render the final game over screen
  }

  restart() {
    this.setup();
    this.startGameLoop();
  }

  // Separate resize handler method for debouncing
  handleResize() {
    // Use requestAnimationFrame to avoid too many resize calculations
    if (this.resizeRAF) {
      cancelAnimationFrame(this.resizeRAF);
    }
    this.resizeRAF = requestAnimationFrame(() => {
      this.resizeAndCalculate();
      this.resizeRAF = null;
    });
  }

  // Load high score from localStorage
  loadHighScore() {
    const storedHighScore = localStorage.getItem(this.localStorageKey);
    if (storedHighScore !== null) {
      this.highScore = parseInt(storedHighScore, 10);
    }
  }

  // Save high score to localStorage
  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(this.localStorageKey, this.highScore.toString());
    }
  }
}

// Character Class
class Character {
  constructor(config, gridSize, cellSize) {
    // Now receives dynamic cellSize
    this.config = config;
    this.gridSize = gridSize;
    this.cellSize = cellSize; // Store dynamic cell size
    const startX = Math.floor(gridSize.w / 2);
    const startY = Math.floor(gridSize.h / 2);
    this.segments = [{ x: startX, y: startY }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this._lastTailPosition = null; // Initialize for growth
  }

  setDirection(newDirection) {
    // Prevent immediate reversal
    if (
      this.segments.length > 1 &&
      newDirection.x === -this.direction.x &&
      newDirection.y === -this.direction.y
    ) {
      return;
    }
    this.nextDirection = newDirection;
  }

  move() {
    this.direction = this.nextDirection; // Update direction before moving
    const head = { ...this.segments[0] }; // Copy current head position

    // Calculate new head position
    head.x += this.direction.x;
    head.y += this.direction.y;

    // Check for wall collisions
    if (
      head.x < 0 ||
      head.x >= this.gridSize.w ||
      head.y < 0 ||
      head.y >= this.gridSize.h
    ) {
      return false; // Wall collision
    }

    // Check for self-collision
    if (
      this.segments.length > 1 &&
      this.segments
        .slice(1)
        .some(segment => segment.x === head.x && segment.y === head.y)
    ) {
      return false; // Self collision
    }

    // Store the position of the last segment BEFORE moving
    const tailPosition = { ...this.segments[this.segments.length - 1] };

    // Move: Add new head, remove tail
    this.segments.unshift(head);
    this.segments.pop();

    // Store tail position for growth
    this._lastTailPosition = tailPosition;

    return true; // Moved successfully
  }

  grow() {
    // Add a segment at the position where the tail *was* before the last move.
    if (this._lastTailPosition) {
      this.segments.push(this._lastTailPosition);
      this._lastTailPosition = null; // Consume the position
    } else {
      // Fallback if grow is called unexpectedly (e.g., first move)
      this.segments.push({ ...this.segments[this.segments.length - 1] });
    }
  }

  draw(ctx, headImage, bodyImage, cellSize) {
    // Uses dynamic cellSize
    this.segments.forEach((segment, index) => {
      const drawX = segment.x * cellSize.w;
      const drawY = segment.y * cellSize.h;
      const imageToDraw = index === 0 ? headImage : bodyImage;
      const fallbackColor = index === 0 ? '#333' : '#f00';

      if (imageToDraw) {
        // Use calculated cell size for drawing
        ctx.drawImage(imageToDraw, drawX, drawY, cellSize.w, cellSize.h);
      } else {
        ctx.fillStyle = fallbackColor;
        // Use calculated cell size for drawing fallback rectangles
        ctx.fillRect(drawX, drawY, cellSize.w - 1, cellSize.h - 1);
      }
    });
  }
}

// Item Class
class Item {
  constructor(config, x, y) {
    this.config = config;
    this.x = x;
    this.y = y;
  }

  draw(ctx, itemImage, cellSize) {
    // Uses dynamic cellSize
    const drawX = this.x * cellSize.w;
    const drawY = this.y * cellSize.h;
    if (itemImage) {
      // Use calculated cell size for drawing
      ctx.drawImage(itemImage, drawX, drawY, cellSize.w, cellSize.h);
    } else {
      ctx.fillStyle = '#f00';
      // Use calculated cell size for drawing fallback rectangles
      ctx.fillRect(drawX, drawY, cellSize.w - 1, cellSize.h - 1);
    }
  }
}

// Example configuration with dynamic URLs based on topic
const gameConfig = {
  character: {
    imageSrc: GAME_ASSETS.character,
    width: 20,
    height: 20,
  },
  item: {
    imageSrc: GAME_ASSETS.item,
    width: 20,
    height: 20,
  },
  background: {
    imageSrc: GAME_ASSETS.background,
  },
  grid: {
    width: 20, // number of cells horizontally
    height: 20, // number of cells vertically
  },
};

// Initialize game on load
window.addEventListener('load', () => {
  const game = new Game('gameCanvas', gameConfig);
  game.init();
});
