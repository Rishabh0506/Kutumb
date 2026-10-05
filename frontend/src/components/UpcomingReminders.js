import React, { useEffect, useState } from 'react';
import api from '../api/api';

const UpcomingReminders = ({ familyId }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId) return;

    const fetchReminders = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/reminders/${familyId}`);
        setReminders(response.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch reminders:", err);
        setError("Could not load reminders.");
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
  }, [familyId]);

  if (loading) return <div className="p-4 text-gray-500">Loading upcoming features...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!reminders.length) return <div className="p-4 text-gray-500 text-sm">No upcoming family events for the next 30 days.</div>;

  return (
    <div className="space-y-4">
      {reminders.map((event, idx) => {
        let textStyle = "text-blue-400";
        let bgStyle = "bg-blue-500/10 border-blue-500/20";
        let icon = "🎂";

        if (event.event_type.includes("Death")) {
          textStyle = "text-gray-400";
          bgStyle = "bg-white/5 border-white/10";
          icon = "🕯️";
        } else if (event.event_type.includes("Anniversary") || event.event_type.includes("Wedding")) {
          textStyle = "text-rose-400";
          bgStyle = "bg-rose-500/10 border-rose-500/20";
          icon = "💍";
        }

        return (
          <div key={`${event.id}-${idx}`} className={`p-4 rounded-lg border ${bgStyle} flex justify-between items-center transition hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)]`}>
            <div>
              <p className="font-semibold text-white">
                {icon} {event.first_name} {event.last_name}'s {event.event_type}
              </p>
              <p className={`text-sm ${textStyle} font-medium mt-1`}>
                {new Date(event.next_occurrence).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${event.days_away === 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-gray-300 border border-white/10'}`}>
              {event.days_away === 0 ? "TODAY!" : `In ${event.days_away} Days`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UpcomingReminders;
