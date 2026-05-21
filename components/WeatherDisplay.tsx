import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind } from 'lucide-react';
import { WeatherConfig } from '../types';

interface WeatherDisplayProps {
  config?: WeatherConfig;
}

const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ config }) => {
  const [weatherText, setWeatherText] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const getWeatherIcon = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('晴') || t.includes('sunny')) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (t.includes('云') || t.includes('cloud')) return <Cloud className="w-4 h-4 text-gray-500" />;
    if (t.includes('雨') || t.includes('rain')) return <CloudRain className="w-4 h-4 text-blue-500" />;
    if (t.includes('雪') || t.includes('snow')) return <CloudSnow className="w-4 h-4 text-blue-300" />;
    if (t.includes('风') || t.includes('wind')) return <Wind className="w-4 h-4 text-gray-600" />;
    return <Sun className="w-4 h-4 text-yellow-500" />;
  };

  useEffect(() => {
    if (!config || !config.enabled) return;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        if (config.provider === 'jinrishici') {
          const res = await fetch('https://v2.jinrishici.com/info');
          if (res.ok) {
            const data = await res.json();
            const wd = data.data?.weatherData;
            if (wd) {
              const parts = [wd.weather, wd.temperature ? `${wd.temperature}°C` : ''].filter(Boolean);
              setWeatherText(parts.join(' '));
              setRegion(wd.region);
            }
          }
        } else if (config.provider === 'qweather' && config.qweatherApiKey && config.qweatherLocation) {
          const host = config.qweatherHost || 'devapi.qweather.com';
          const res = await fetch(`https://${host}/v7/weather/now?location=${config.qweatherLocation}&key=${config.qweatherApiKey}`);
          if (res.ok) {
            const data = await res.json();
            if (data.now) {
              const unit = config.unit === 'fahrenheit' ? '°F' : '°C';
              setWeatherText(`${data.now.text} ${data.now.temp}${unit}`);
              // QWeather location might need another API call to get name, or we use the location ID
              setRegion(config.qweatherLocation);
            }
          }
        } else if (config.provider === 'openweather' && config.openweatherApiKey) {
          const city = config.openweatherCity || 'Beijing';
          const units = config.unit === 'fahrenheit' ? 'imperial' : 'metric';
          const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${config.openweatherApiKey}&units=${units}`);
          if (res.ok) {
            const data = await res.json();
            const unit = config.unit === 'fahrenheit' ? '°F' : '°C';
            setWeatherText(`${data.weather[0]?.main} ${Math.round(data.main.temp)}${unit}`);
            setRegion(data.name);
          }
        } else if (config.provider === 'visualcrossing' && config.visualcrossingApiKey && config.visualcrossingLocation) {
          const res = await fetch(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${config.visualcrossingLocation}/today?unitGroup=metric&key=${config.visualcrossingApiKey}&contentType=json`);
          if (res.ok) {
            const data = await res.json();
            const today = data.days?.[0];
            if (today) {
              setWeatherText(`${today.conditions} ${Math.round(today.temp)}°C`);
              setRegion(data.address);
            }
          }
        }
      } catch (e) {
        console.error('Weather fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config]);

  if (!config || !config.enabled) return null;

  if (loading && !weatherText) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-full text-xs text-slate-500 dark:text-slate-400 h-9 min-w-10 leading-none">
        <Cloud className="w-4 h-4 animate-pulse" />
        <span className="hidden md:inline">加载中...</span>
      </div>
    );
  }

  if (!weatherText) return null;

  return (
    <div
      className="relative flex items-center gap-2 bg-slate-200 dark:bg-slate-700 rounded-full px-3 py-2 h-9 min-w-10 leading-none cursor-default group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {getWeatherIcon(weatherText)}
      <span className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
        {weatherText}
      </span>
      {isHovering && region && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 dark:bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
          <div className="text-slate-300">城市：{region}</div>
          <div>天气：{weatherText}</div>
        </div>
      )}
    </div>
  );
};

export default WeatherDisplay;
