// OpenWeatherMap API
const API_KEY = '4b16e1a0bfef03be377e4ad53e6c26a2';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// DOM элементы
const searchInput = document.getElementById('search');
const searchButton = document.getElementById('search-button');
const locationElement = document.getElementById('location');
const dateElement = document.getElementById('date');
const temperatureElement = document.getElementById('temperature');
const weatherIconElement = document.getElementById('weather-icon');
const realFeelElement = document.getElementById('real-feel');
const chanceOfRainElement = document.getElementById('chance-of-rain');
const windElement = document.getElementById('wind');
const uvIndexElement = document.getElementById('uv-index');
const hourlyItems = document.querySelectorAll('.today-forecast .forecast-item');
const dailyItems = document.querySelectorAll('.week-forecast .forecast-item-week');

// Основное иконопоказы: для текущей и суточной прогнозов
function getLocalIcon(main) {
  switch (main) {
    case 'Clear': return 'icons/sun-icon.png';
    case 'Clouds': return 'icons/cloud-icon.png';
    case 'Rain': return 'icons/rain-icon.png';
    case 'Drizzle': return 'icons/sun-rain-icon.png';
    case 'Thunderstorm': return 'icons/storm-icon.png';
    case 'Snow': return 'icons/snow-icon.png';
    default: return 'icons/sun-icon.png';
  }
}

// Иконки для почасового прогноза (с учётом времени)
function getHourlyIcon(main, hour) {
  const isDay = hour >= 6 && hour < 18;
  switch (main) {
    case 'Clear':
      return isDay ? 'icons/sun-icon-today.png' : 'icons/moon-icon-today.png';
    case 'Clouds':
      return 'icons/cloud-icon-today.png';
    case 'Rain':
      return 'icons/rain-icon-today.png';
    case 'Drizzle':
      return isDay ? 'icons/sun-rain-icon-today.png' : 'icons/moon-rain-icon-today.png';
    case 'Thunderstorm':
      return 'icons/storm-icon-today.png';
    default:
      return 'icons/cloud-icon-today.png';
  }
}

// Метки часов, по которым мы обновляем прогноз
const desiredHours = [6, 10, 14, 18, 22];

// События
searchButton.addEventListener('click', () => {
  const city = searchInput.value.trim();
  if (city) getCurrentWeather(city);
});
searchInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    const city = searchInput.value.trim();
    if (city) getCurrentWeather(city);
  }
});
// window.addEventListener('load', () => getCurrentWeather('Казань'));
getCurrentWeather('Казань');

// Получаем текущую погоду
async function getCurrentWeather(city) {
  try {
    const res = await fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    locationElement.textContent = `${data.name}, ${data.sys.country}`;
    dateElement.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    temperatureElement.textContent = `${Math.round(data.main.temp)}°C`;
    weatherIconElement.src = getLocalIcon(data.weather[0].main);
    weatherIconElement.alt = data.weather[0].description;
    realFeelElement.textContent = `${Math.round(data.main.feels_like)}°C`;
    windElement.textContent = `${data.wind.speed} km/h`;

    await getForecast(data.coord.lat, data.coord.lon);
  } catch (err) {
    console.error(err);
    alert('Ошибка: ' + err.message);
  }
}

// Старый getForecast — заменяем полностью:
async function getForecast(lat, lon) {
    try {
      // вместо onecall берём 5-дневный прогноз с шагом 3 часа
      const res = await fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
  
      // обновляем почасовой прогноз по data.list
      updateHourlyForecast(data.list);
  
      // разбиваем на дни и берём один элемент на каждый день
      const dailyList = data.list
        .filter(item => item.dt_txt.endsWith("12:00:00"))
        .slice(0, 7);

        updateDailyForecast(dailyList);
  
      // отдельный запрос для UV (если у ключа есть доступ)
      const uvRes = await fetch(
        `${BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      );
      const uvData = await uvRes.json();
      uvIndexElement.textContent = uvData.value;
      if (dailyList[0]?.pop !== undefined) {
        chanceOfRainElement.textContent = `${Math.round(dailyList[0].pop * 100)}%`;
      }
      document.body.classList.remove('loading');
    } catch (err) {
      console.error(err);
    }
  }
  

// Обновляем почасовой прогноз по фиксированным часам
// Обновлённая функция updateHourlyForecast: фильтруем текущий день и ищем ближайший час
function updateHourlyForecast(list) {
    desiredHours.forEach((targetHour, idx) => {
      const item = hourlyItems[idx];
      // Ищем в списке прогнозов ближайший по значению часа к targetHour
      const bestMatch = list.reduce((prev, curr) => {
        const prevHour = new Date(prev.dt * 1000).getHours();
        const currHour = new Date(curr.dt * 1000).getHours();
        return Math.abs(currHour - targetHour) < Math.abs(prevHour - targetHour) ? curr : prev;
      });
      const h = new Date(bestMatch.dt * 1000).getHours();
      item.querySelector('.icon img').src = getHourlyIcon(bestMatch.weather[0].main, h);
      item.querySelector('.temp').textContent = `${Math.round(bestMatch.main.temp)}°C`;
      item.querySelector('.time').textContent = `${h % 12 || 12}${h < 12 ? ' AM' : ' PM'}`;
    });
  }
  
  
  
  // — Полная замена updateDailyForecast на работу с data.list из /forecast:
  function updateDailyForecast(dailyArray) {
    dailyArray.forEach((dayData, idx) => {
      const item = dailyItems[idx];
      if (!item) return;
  
      // Вычисляем название дня
      const dayName = new Date(dayData.dt * 1000)
        .toLocaleDateString('en-US', { weekday: 'long' });
  
      // Путь до вашей локальной иконки
      const iconPath = getLocalIcon(dayData.weather[0].main);
  
      item.querySelector('.day').textContent  = dayName;
      item.querySelector('.temp').textContent = `${Math.round(dayData.main.temp)}°C`;
      item.querySelector('.icon img').src     = iconPath;
    });
  }
  