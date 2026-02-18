import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

const RegisterCA: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    caCode: '',
    firmName: '',
    fullName: '',
    email: '',
    username: '',
    password: '',
    defaultFormat: 'Tally'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.registerCA({
        ca_code: formData.caCode.toUpperCase().trim(),
        firm_name: formData.firmName,
        full_name: formData.fullName,
        email: formData.email,
        username: formData.username,
        password: formData.password,
      });
      alert(`Registration successful!\n\nYour CA Code is: ${formData.caCode.toUpperCase()}\n\nShare this code with your clients so they can register under your firm.`);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      if (err.message?.toLowerCase().includes('ca code') || err.message?.toLowerCase().includes('ca_code')) {
        setStep(1);
      } else if (err.message?.toLowerCase().includes('username') || err.message?.toLowerCase().includes('email')) {
        setStep(2);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Register your CA Firm
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Join the automated GSTR1 mapping ecosystem
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-200 sm:rounded-2xl sm:px-10">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase ${step >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}>Firm Details</span>
              <span className={`text-xs font-bold uppercase ${step >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}>Account Security</span>
              <span className={`text-xs font-bold uppercase ${step >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>Confirm</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${(step / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* ── Step 1: Firm Details + CA Code ── */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                {/* CA Code — manual entry */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    CA Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={10}
                    pattern="[A-Za-z0-9]+"
                    title="Only letters and numbers, no spaces"
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-mono tracking-widest uppercase"
                    placeholder="e.g. SHARMA01"
                    value={formData.caCode}
                    onChange={e => setFormData({ ...formData, caCode: e.target.value.toUpperCase() })}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    4–10 characters, letters & numbers only. <strong>Share this with your clients</strong> so they can register under your firm.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Firm Name</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    placeholder="e.g. Sharma & Associates"
                    value={formData.firmName}
                    onChange={e => setFormData({ ...formData, firmName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Practice Head (Full Name)</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    placeholder="name@firm.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* ── Step 2: Account Security ── */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Login Username</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Secure Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-slate-400">Minimum 8 characters</p>
                </div>
              </div>
            )}

            {/* ── Step 3: Confirm ── */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-2">
                  <p className="text-sm font-semibold text-indigo-800">Please confirm your details:</p>
                  <div className="text-sm text-indigo-700 space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">CA Code</span><strong className="font-mono tracking-widest">{formData.caCode.toUpperCase()}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-500">Firm</span><span>{formData.firmName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Name</span><span>{formData.fullName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Email</span><span>{formData.email}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Username</span><span>{formData.username}</span></div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Share your CA Code <strong className="font-mono">{formData.caCode.toUpperCase()}</strong> with clients so they can register under your firm.
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-3 px-4 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !formData.caCode}
                  className="flex-1 py-3 px-4 bg-indigo-600 rounded-xl text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-300 shadow-lg shadow-indigo-100 transition-all"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-indigo-600 rounded-xl text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-400 shadow-lg shadow-indigo-100 transition-all"
                >
                  {isLoading ? 'Registering...' : 'Complete Registration'}
                </button>
              )}
            </div>
          </form>

          <div className="mt-8 text-center">
            <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Already registered? Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterCA;