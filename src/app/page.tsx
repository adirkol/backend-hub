"use client";

import { useEffect, useState } from "react";
/* eslint-disable @next/next/no-img-element */

const funnyMessages = [
  "This is not the endpoint you're looking for...",
  "Plot twist: There's no frontend here!",
  "Congratulations! You've found... absolutely nothing.",
  "Error 418: I'm a teapot. Just kidding, I'm an API.",
  "If you're seeing this, you're probably lost.",
  "Welcome to the void. Population: just you.",
  "This page intentionally left unhelpful.",
  "Achievement Unlocked: Found the useless page!",
];

const gifs = [
  // "Nothing to see here" - classic
  "https://media.giphy.com/media/joV1k1sNOT5xC/giphy.gif",
  // Confused Travolta
  "https://media.giphy.com/media/hEc4k5pN17GZq/giphy.gif",
  // This is fine (dog in fire)
  "https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif",
  // Tumbleweed
  "https://media.giphy.com/media/5x89XRx3sBZFC/giphy.gif",
];

export default function Home() {
  const [message, setMessage] = useState("");
  const [gif, setGif] = useState("");
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    setMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
    setGif(gifs[Math.floor(Math.random() * gifs.length)]);
  }, []);

  const handleClick = () => {
    setClickCount((prev) => prev + 1);
    if (clickCount >= 4) {
      setShowEasterEgg(true);
    } else {
      // Change message and gif on click
      setMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
      setGif(gifs[Math.floor(Math.random() * gifs.length)]);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
      }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-96 h-96 rounded-full opacity-10 blur-3xl animate-pulse"
          style={{
            background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
            top: "10%",
            left: "10%",
            animationDuration: "4s",
          }}
        />
        <div 
          className="absolute w-80 h-80 rounded-full opacity-10 blur-3xl animate-pulse"
          style={{
            background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
            bottom: "10%",
            right: "10%",
            animationDuration: "5s",
            animationDelay: "1s",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-2xl">
        {/* Logo/Title */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
            }}
          >
            🤖
          </div>
          <span 
            className="text-2xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI Backend Hub
          </span>
        </div>

        {/* GIF Container */}
        <div 
          className="relative cursor-pointer group"
          onClick={handleClick}
        >
          <div 
            className="absolute inset-0 rounded-2xl opacity-50 blur-xl transition-opacity group-hover:opacity-70"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
            }}
          />
          <div 
            className="relative rounded-2xl overflow-hidden border transition-transform group-hover:scale-[1.02]"
            style={{
              borderColor: "rgba(99, 102, 241, 0.3)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            }}
          >
            {gif && (
              <img 
                src={gif}
                alt="Nothing to see here"
                className="w-80 h-60 object-cover"
              />
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 text-xs bg-zinc-800 px-2 py-1 rounded-full border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
            Click me!
          </div>
        </div>

        {/* Message */}
        <div className="text-center space-y-4">
          <h1 
            className="text-3xl md:text-4xl font-bold tracking-tight transition-all duration-300"
            style={{
              color: "#fafafa",
              textShadow: "0 2px 20px rgba(99, 102, 241, 0.3)",
            }}
          >
            {showEasterEgg ? "🎉 You found the easter egg!" : "Nothing to see here"}
          </h1>
          <p 
            className="text-lg md:text-xl transition-all duration-300"
            style={{ color: "#a1a1aa" }}
          >
            {showEasterEgg 
              ? "You're persistent! Have a virtual cookie 🍪" 
              : message}
          </p>
        </div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white opacity-20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
