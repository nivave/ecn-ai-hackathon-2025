// game.js - Flappy Bird style game

// Utility to load images asynchronously
const loadImage = src =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
  });

// Pipe obstacle class (for Flappy Bird style game)
class Pipe {
  constructor(image, gapY, gapHeight, width, speed, canvasWidth) {
    this.image = image;
    this.width = width;
    this.gapY = gapY;
    this.gapHeight = gapHeight;
    this.speed = speed;
    this.x = canvasWidth;
    this.scored = false;
  }

  update(dt) {
    this.x -= this.speed * dt;
  }

  draw(ctx, canvasHeight) {
    // Draw top pipe (inverted)
    ctx.save();
    ctx.translate(this.x, this.gapY);
    ctx.scale(1, -1);
    ctx.drawImage(this.image, 0, 0, this.width, canvasHeight);
    ctx.restore();

    // Draw bottom pipe
    ctx.drawImage(
      this.image,
      this.x,
      this.gapY + this.gapHeight,
      this.width,
      canvasHeight
    );
  }

  isColliding(bird) {
    // Check if bird is within pipe horizontally
    if (bird.x + bird.width > this.x && bird.x < this.x + this.width) {
      // Check if bird hit top or bottom pipe
      if (
        bird.y < this.gapY ||
        bird.y + bird.height > this.gapY + this.gapHeight
      ) {
        return true;
      }
    }
    return false;
  }
}

// Main Game class for Flappy Bird style
class Game {
  constructor(canvasId, config) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.config = config;

    // Bird properties
    this.bird = {
      x: 0,
      y: 0,
      width: config.bird.width,
      height: config.bird.height,
      velocity: 0,
    };

    this.birdImage = null;
    this.pipeImage = null;
    this.backgroundImage = null;

    this.pipes = [];
    this.pipeTimer = 0;
    this.score = 0;
    // High score tracking
    this.highScore = 0;
    this.topic = GAME_ASSETS.topic || 'default';
    this.localStorageKey = `dodgeDanger_highScore_${this.topic}`;

    this.gameOver = false;
    this.lastTime = 0;

    // Physics constants
    this.gravity = 1500; // pixels/second²
    this.jumpVelocity = -500; // pixels/second
  }

  init() {
    // Setup canvas
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Background scrolling properties
    this.bgX = 0;
    this.bgScrollSpeed = 30; // pixels per second, slower than pipes

    // Initial bird position
    this.bird.x = this.canvas.width * 0.2;
    this.bird.y = this.canvas.height / 2;

    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      if (!this.gameOver) {
        this.bird.x = this.canvas.width * 0.2;
      }
    });

    // Touch/click input for jumping
    const jumpHandler = e => {
      e.preventDefault();
      if (!this.gameOver) {
        this.bird.velocity = this.jumpVelocity;
      } else {
        // Restart on tap when game over
        this.restart();
      }
    };

    this.canvas.addEventListener('touchstart', jumpHandler, { passive: false });
    this.canvas.addEventListener('click', jumpHandler);

    // Load all images
    const assetPromises = [
      loadImage(this.config.bird.imageSrc),
      loadImage(this.config.pipe.imageSrc),
      loadImage(this.config.background.imageSrc),
    ];

    Promise.all(assetPromises)
      .then(images => {
        // Assign loaded images
        [this.birdImage, this.pipeImage, this.backgroundImage] = images;

        // Load high score from localStorage
        this.loadHighScore();

        // Start game
        this.restart();
      })
      .catch(err => console.error(err));
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

  restart() {
    this.pipes = [];
    this.pipeTimer = 0;
    this.score = 0;
    this.gameOver = false;
    this.bird.y = this.canvas.height / 2;
    this.bird.velocity = 0;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // Cap dt to prevent jumps after pause
    this.lastTime = timestamp;
    this.update(dt);
    this.render();
    if (!this.gameOver) requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    if (this.gameOver) return;

    if (this.backgroundImage) {
      const bgWidth =
        (this.backgroundImage.width / this.backgroundImage.height) *
        this.canvas.height;
      this.bgX = (this.bgX - this.bgScrollSpeed * dt) % bgWidth;
    }

    // Update bird physics
    this.bird.velocity += this.gravity * dt;
    this.bird.y += this.bird.velocity * dt;

    // Game over if bird hits top or bottom
    if (
      this.bird.y < 0 ||
      this.bird.y + this.bird.height > this.canvas.height
    ) {
      this.gameOver = true;
      this.saveHighScore(); // Save high score when game over
      return;
    }

    // Spawn pipes
    this.pipeTimer -= dt;
    if (this.pipeTimer <= 0) {
      const gapHeight = this.config.pipe.gapHeight;
      const minY = gapHeight * 0.5;
      const maxY = this.canvas.height - gapHeight * 1.5;
      const gapY = minY + Math.random() * (maxY - minY);

      this.pipes.push(
        new Pipe(
          this.pipeImage,
          gapY,
          gapHeight,
          this.config.pipe.width,
          this.config.pipe.speed,
          this.canvas.width
        )
      );

      // Reset timer with slight randomization
      this.pipeTimer =
        this.config.pipe.spawnInterval * (0.8 + Math.random() * 0.4);

      // Increase difficulty over time
      this.config.pipe.speed += this.config.difficulty.speedIncreaseRate;
      this.config.pipe.gapHeight = Math.max(
        80,
        this.config.pipe.gapHeight - this.config.difficulty.gapDecreaseRate
      );
    }

    // Update pipes and check collisions
    this.pipes.forEach(pipe => {
      pipe.update(dt);

      // Score when bird passes pipe
      if (!pipe.scored && pipe.x + pipe.width < this.bird.x) {
        this.score++;
        pipe.scored = true;
      }

      // Check collisions
      if (pipe.isColliding(this.bird)) {
        this.gameOver = true;
        this.saveHighScore(); // Save high score when game over
      }
    });

    // Remove off-screen pipes
    this.pipes = this.pipes.filter(pipe => pipe.x > -pipe.width);
  }

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Draw background with proper aspect ratio and scrolling
    if (this.backgroundImage) {
      // Calculate background dimensions preserving aspect ratio
      const bgRatio = this.backgroundImage.width / this.backgroundImage.height;
      const bgHeight = ch;
      const bgWidth = bgHeight * bgRatio;

      // Ensure bgX loops correctly (handle negative modulo results)
      let currentX = this.bgX % bgWidth;
      if (currentX > 0) {
        currentX -= bgWidth;
      }

      // Draw enough copies to cover the screen plus potentially one extra for smooth wrap
      let drawnWidth = currentX;
      while (drawnWidth < cw) {
        ctx.drawImage(this.backgroundImage, drawnWidth, 0, bgWidth, bgHeight);
        drawnWidth += bgWidth;
      }
    } else {
      // Fallback background color if image not loaded
      ctx.fillStyle = '#70c5ce'; // Light blue fallback
      ctx.fillRect(0, 0, cw, ch);
    }

    // Draw pipes
    this.pipes.forEach(pipe => pipe.draw(ctx, ch));

    // Draw bird
    ctx.save();
    // Rotate bird based on velocity (pointing up/down)
    const angle = Math.min(
      Math.PI / 4,
      Math.max(-Math.PI / 4, this.bird.velocity / 500)
    );
    ctx.translate(
      this.bird.x + this.bird.width / 2,
      this.bird.y + this.bird.height / 2
    );
    ctx.rotate(angle);
    ctx.drawImage(
      this.birdImage,
      -this.bird.width / 2,
      -this.bird.height / 2,
      this.bird.width,
      this.bird.height
    );
    ctx.restore();

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.score}`, cw / 2, 50);

    // Draw high score during gameplay
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`High Score: ${this.highScore}`, cw - 10, 30);

    // Draw game over
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = '#fff';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', cw / 2, ch / 2 - 50);
      ctx.font = '24px sans-serif';
      ctx.fillText(`Score: ${this.score}`, cw / 2, ch / 2);

      // Show high score in game over screen
      if (this.score >= this.highScore) {
        ctx.fillStyle = '#ffff00'; // Yellow for new high score
        ctx.fillText(`New High Score!`, cw / 2, ch / 2 + 40);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillText(`High Score: ${this.highScore}`, cw / 2, ch / 2 + 40);
      }

      ctx.fillStyle = '#fff';
      ctx.fillText('Tap to restart', cw / 2, ch / 2 + 80);
    }
  }
}

// Flappy Bird style config
const gameConfig = {
  bird: {
    imageSrc: GAME_ASSETS.character,
    width: 40,
    height: 40,
  },
  pipe: {
    imageSrc: GAME_ASSETS.item,
    width: 120,
    gapHeight: 200,
    speed: 200,
    spawnInterval: 2.5,
  },
  background: {
    imageSrc: GAME_ASSETS.background,
  },
  difficulty: {
    speedIncreaseRate: 2,
    gapDecreaseRate: 0.5,
  },
};

// Initialize game on load
window.addEventListener('load', () => {
  const game = new Game('gameCanvas', gameConfig);
  game.init();
});
