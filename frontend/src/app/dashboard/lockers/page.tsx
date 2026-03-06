'use client';
import { useEffect, useState } from 'react';
import { api, Locker } from '@/lib/api';
import LockerCard from '@/components/LockerCard';

interface NewLockerForm {
  name: string;
  address: string;
  lat: string;
  lon: string;
  qr_code: string;
}

export default function LockersPage() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewLockerForm>({ name: '', address: '', lat: '', lon: '', qr_code: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function loadLockers() {
    setLoading(true);
    api.getLockers()
      .then(setLockers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLockers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.createLocker({
        name: form.name,
        address: form.address,
        lat: parseFloat(form.lat),
        lon: parseFloat(form.lon),
        qr_code: form.qr_code,
      });
      setShowModal(false);
      setForm({ name: '', address: '', lat: '', lon: '', qr_code: '' });
      loadLockers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Локеры</h1>
          <p className="text-gray-500 text-sm mt-1">Управление аккумуляторными локерами</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Добавить локер
        </button>
      </div>

      {loading && <div className="text-center text-gray-400 py-16">Загрузка...</div>}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lockers.map(locker => (
              <LockerCard key={locker.id} locker={locker} />
            ))}
          </div>
          {lockers.length === 0 && (
            <div className="text-center text-gray-400 py-16">Локеры не найдены</div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Добавить локер</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { field: 'name', label: 'Название', placeholder: 'Локер №1' },
                { field: 'address', label: 'Адрес', placeholder: 'ул. Примерная, 1' },
                { field: 'lat', label: 'Широта', placeholder: '55.7558' },
                { field: 'lon', label: 'Долгота', placeholder: '37.6176' },
                { field: 'qr_code', label: 'QR-код', placeholder: 'QR_CODE_001' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[field as keyof NewLockerForm]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              {formError && <div className="text-red-600 text-sm">{formError}</div>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
