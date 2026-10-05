import React, { useRef, useEffect } from 'react';

const CanvasNetwork = ({ mousePos }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const numParticles = Math.min(window.innerWidth / 25, 50); 
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 1.5,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          glow: Math.random() * 0.5 + 0.3,
          glowDir: Math.random() > 0.5 ? 0.005 : -0.005
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() / 1000;
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        p.glow += p.glowDir;
        if (p.glow > 0.9 || p.glow < 0.2) p.glowDir *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 220, 220, ${p.glow})`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(225, 29, 72, 0.6)";
        ctx.fill();
        ctx.shadowBlur = 0; 
      });
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const energy = (Math.sin(time * 2 + i) + 1) * 0.5; 
            ctx.strokeStyle = `rgba(225, 29, 72, ${(0.2 - dist/600) * energy})`;
            ctx.lineWidth = 0.5 + energy * 0.5;
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div 
      className="absolute inset-0 z-[-1] pointer-events-none transition-transform duration-1000 ease-out"
      style={{ transform: `translate(${(mousePos?.x || 50) * -0.03 + 1.5}%, ${(mousePos?.y || 50) * -0.03 + 1.5}%) scale(1.05)` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-80" />
    </div>
  );
};

export default CanvasNetwork;
