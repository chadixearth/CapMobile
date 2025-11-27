// Standardized time constants across the app
export const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00'
];

export const formatTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const isTimeInPast = (dateString, timeString) => {
  const now = new Date();
  const [hours, minutes] = timeString.split(':').map(Number);
  const checkDate = new Date(dateString);
  checkDate.setHours(hours, minutes, 0, 0);
  return checkDate < now;
};

export const isDateInPast = (dateString) => {
  const checkDate = new Date(dateString);
  const today = new Date();
  checkDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return checkDate < today;
};

export const getValidTimeSlotsForDate = (dateString) => {
  const today = new Date();
  const checkDate = new Date(dateString);
  
  checkDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  // If not today, return all slots
  if (checkDate.getTime() !== today.getTime()) {
    return TIME_SLOTS;
  }
  
  // For today, filter out past hours
  const currentHour = new Date().getHours();
  return TIME_SLOTS.filter(time => {
    const hour = parseInt(time.split(':')[0]);
    return hour > currentHour;
  });
};
