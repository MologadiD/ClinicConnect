import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BookingDraft {
  clinicId?: string;
  clinicName?: string;
  serviceId?: string;
  serviceName?: string;
  timeSlotId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

interface AppointmentContextType {
  draft: BookingDraft;
  setDraft: (d: BookingDraft) => void;
  clearDraft: () => void;
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

export const AppointmentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [draft, setDraftState] = useState<BookingDraft>({});
  const setDraft = (d: BookingDraft) => setDraftState((prev) => ({ ...prev, ...d }));
  const clearDraft = () => setDraftState({});

  return (
    <AppointmentContext.Provider value={{ draft, setDraft, clearDraft }}>
      {children}
    </AppointmentContext.Provider>
  );
};

export const useAppointment = () => {
  const ctx = useContext(AppointmentContext);
  if (!ctx) throw new Error('useAppointment must be used within AppointmentProvider');
  return ctx;
};
