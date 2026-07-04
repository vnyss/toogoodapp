import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { login, register, sendResetCode, verifyResetCode } from '../api';
import { saveAuth } from '../auth';

const MONO = "'JetBrains Mono', monospace";
const DISPLAY = "'Inter', sans-serif";
const GOLD = '#C9A84C';
const BG   = '#000000';
const CARD = '#0A0A0A';
const TEXT  = '#E8DCC8';
const TEXT2 = '#8A7A62';
const TEXT3 = '#50422E';
const BORDER = 'rgba(201,168,76,0.18)';
const ERR   = '#CF6679';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria',
  'Cambodia','Cameroon','Canada','Chile','China','Colombia','Croatia','Cuba','Czech Republic',
  'Denmark','Ecuador','Egypt','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece',
  'Guatemala','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan',
  'Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Lebanon','Libya','Malaysia','Mexico',
  'Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan',
  'Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia',
  'Senegal','Serbia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden',
  'Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uzbekistan','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe',
];

function EyeIcon({ open }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: TEXT2, strokeWidth: '1.8', strokeLinecap: 'round' };
  if (open) return (
    <Svg {...p}>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
  return (
    <Svg {...p}>
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

function PasswordField({ value, onChange, placeholder, onSubmit }) {
  const [show, setShow] = useState(false);
  return (
    <View style={st.pwWrap}>
      <TextInput
        style={[st.input, { flex: 1 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || '••••••••'}
        placeholderTextColor={TEXT3}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
      />
      <TouchableOpacity style={st.eyeBtn} onPress={() => setShow(v => !v)}>
        <EyeIcon open={show} />
      </TouchableOpacity>
    </View>
  );
}

/* ── Forgot password view — 3-step OTP flow ────────────────────────────── */
function ForgotPasswordView({ onBack }) {
  const [step,      setStep]     = useState('email');   // 'email' | 'code' | 'done'
  const [email,     setEmail]    = useState('');
  const [code,      setCode]     = useState('');
  const [newPw,     setNewPw]    = useState('');
  const [confirmPw, setConfirmPw]= useState('');
  const [error,     setError]    = useState('');
  const [loading,   setLoading]  = useState(false);

  async function handleSendCode() {
    if (!email.trim()) { setError('Enter your registered email address.'); return; }
    setError(''); setLoading(true);
    try {
      await sendResetCode(email.trim().toLowerCase());
      setStep('code');
    } catch {
      setError('Could not reach server. Check your network.');
    }
    setLoading(false);
  }

  async function handleVerify() {
    if (code.trim().length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    if (newPw.length < 8)         { setError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw)       { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      const d = await verifyResetCode(email.trim().toLowerCase(), code.trim(), newPw);
      if (d.ok) { setStep('done'); }
      else      { setError(d.error || 'Invalid or expired code.'); }
    } catch {
      setError('Could not reach server. Check your network.');
    }
    setLoading(false);
  }

  return (
    <View style={st.card}>
      <View style={st.goldAccent} />
      <Text style={st.tag}>ACCOUNT // ACCESS RECOVERY</Text>
      <Text style={st.title}>Reset password</Text>

      {step === 'email' && (
        <>
          <Text style={st.subtitle}>Enter your registered email — we'll send a 6-digit verification code.</Text>
          <View style={st.fieldGroup}>
            <Text style={st.label}>Email address</Text>
            <TextInput
              style={st.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={TEXT3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={handleSendCode}
            />
          </View>
          {!!error && <Text style={st.error}>{error}</Text>}
          <TouchableOpacity style={[st.submit, loading && { opacity: 0.6 }]} onPress={handleSendCode} disabled={loading}>
            <Text style={st.submitTxt}>{loading ? 'Sending…' : 'Send verification code'}</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'code' && (
        <>
          <Text style={st.subtitle}>A 6-digit code was sent to <Text style={{ color: GOLD }}>{email}</Text>. Enter it below along with your new password.</Text>
          <View style={st.fieldGroup}>
            <Text style={st.label}>Verification code</Text>
            <TextInput
              style={[st.input, { letterSpacing: 8, fontSize: 22, textAlign: 'center' }]}
              value={code}
              onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={TEXT3}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
          <View style={st.fieldGroup}>
            <Text style={st.label}>New password</Text>
            <TextInput
              style={st.input}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="Min. 8 characters"
              placeholderTextColor={TEXT3}
              secureTextEntry
            />
          </View>
          <View style={st.fieldGroup}>
            <Text style={st.label}>Confirm new password</Text>
            <TextInput
              style={st.input}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Repeat password"
              placeholderTextColor={TEXT3}
              secureTextEntry
              onSubmitEditing={handleVerify}
            />
          </View>
          {!!error && <Text style={st.error}>{error}</Text>}
          <TouchableOpacity style={[st.submit, loading && { opacity: 0.6 }]} onPress={handleVerify} disabled={loading}>
            <Text style={st.submitTxt}>{loading ? 'Verifying…' : 'Reset password'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.switchLink} onPress={() => { setStep('email'); setCode(''); setError(''); }}>
            <Text style={[st.switchTxt, { fontSize: 11, color: TEXT3 }]}>Didn't receive it? <Text style={{ color: GOLD }}>Resend code</Text></Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'done' && (
        <>
          <Text style={{ fontFamily: MONO, fontSize: 13, color: '#4CAF7C', lineHeight: 22, marginBottom: 20 }}>
            Password updated successfully. You can now log in with your new password.
          </Text>
          <TouchableOpacity style={st.submit} onPress={onBack}>
            <Text style={st.submitTxt}>Back to login</Text>
          </TouchableOpacity>
        </>
      )}

      {step !== 'done' && (
        <TouchableOpacity style={st.switchLink} onPress={onBack}>
          <Text style={st.switchTxt}><Text style={{ color: GOLD }}>← Back to login</Text></Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Login view ─────────────────────────────────────────────────────────── */
function LoginView({ onSuccess, onSignup, onForgot }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) { setError('Enter your username and passphrase.'); return; }
    setError(''); setLoading(true);
    try {
      const d = await login(username.trim(), password);
      if (d.ok || d.token) {
        await saveAuth(d.token || d.auth_token || '', d.username || username.trim());
        onSuccess(d.username || username.trim());
      } else {
        setError(d.error || d.message || 'Invalid credentials.');
      }
    } catch {
      setError('Could not reach server. Check your network.');
    }
    setLoading(false);
  }

  return (
    <View style={st.card}>
      <View style={st.goldAccent} />
      <Text style={st.tag}>ENTRY LOG // ACCESS</Text>
      <Text style={st.title}>Welcome back</Text>
      <Text style={st.subtitle}>The body remembers. Sign back in to continue being better.</Text>

      <View style={st.fieldGroup}>
        <Text style={st.label}>Subject ID</Text>
        <TextInput
          style={st.input}
          value={username}
          onChangeText={setUsername}
          placeholder="USERNAME"
          placeholderTextColor={TEXT3}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleLogin}
        />
      </View>

      <View style={st.fieldGroup}>
        <Text style={st.label}>Passphrase</Text>
        <PasswordField value={password} onChange={setPassword} onSubmit={handleLogin} />
      </View>

      {!!error && <Text style={st.error}>{error}</Text>}

      <TouchableOpacity style={[st.submit, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
        <Text style={st.submitTxt}>{loading ? 'Logging in…' : 'Log in'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={st.switchLink} onPress={onSignup}>
        <Text style={st.switchTxt}>No account? <Text style={{ color: GOLD }}>Create one</Text></Text>
      </TouchableOpacity>

      <TouchableOpacity style={[st.switchLink, { marginTop: 10 }]} onPress={onForgot}>
        <Text style={[st.switchTxt, { fontSize: 11, color: TEXT3 }]}>Forgot password?</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Signup view ────────────────────────────────────────────────────────── */
function SignupView({ onSuccess, onLogin }) {
  const [fullName,   setFullName]   = useState('');
  const [country,    setCountry]    = useState('');
  const [countryQ,   setCountryQ]   = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [email,      setEmail]      = useState('');
  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const filteredCountries = countryQ.length > 0
    ? COUNTRIES.filter(c => c.toLowerCase().startsWith(countryQ.toLowerCase())).slice(0, 6)
    : [];

  async function handleRegister() {
    if (!email.trim())      { setError('Email is required.'); return; }
    if (!username.trim())   { setError('Username is required.'); return; }
    if (password.length < 8){ setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm){ setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      const d = await register({ full_name: fullName, country, email: email.trim(), username: username.trim(), password, confirm_password: confirm });
      if (d.ok || d.token) {
        await saveAuth(d.token || '', d.username || username.trim());
        onSuccess(d.username || username.trim());
      } else {
        setError(d.error || 'Could not create account.');
      }
    } catch {
      setError('Could not reach server. Check your network.');
    }
    setLoading(false);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={st.card}>
        <View style={st.goldAccent} />
        <Text style={st.tag}>NEW SPECIMEN // INTAKE</Text>
        <Text style={st.title}>Begin your arc</Text>
        <Text style={st.subtitle}>Tell us a little about yourself so we can personalise your plan.</Text>

        {/* ── About you ── */}
        <Text style={st.sectionLabel}>About you</Text>

        <View style={st.fieldGroup}>
          <Text style={st.label}>Full name <Text style={{ color: TEXT3, fontSize: 10 }}>(optional)</Text></Text>
          <TextInput
            style={st.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Saksham"
            placeholderTextColor={TEXT3}
            autoCorrect={false}
          />
        </View>

        <View style={[st.fieldGroup, { zIndex: 10 }]}>
          <Text style={st.label}>Country <Text style={{ color: TEXT3, fontSize: 10 }}>(helps personalise your plan)</Text></Text>
          <TextInput
            style={st.input}
            value={countryQ || country}
            onChangeText={v => { setCountryQ(v); setCountry(''); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Start typing your country…"
            placeholderTextColor={TEXT3}
            autoCorrect={false}
          />
          {showDropdown && filteredCountries.length > 0 && (
            <View style={st.dropdown}>
              {filteredCountries.map(c => (
                <TouchableOpacity key={c} style={st.dropdownItem} onPress={() => { setCountry(c); setCountryQ(''); setShowDropdown(false); }}>
                  <Text style={st.dropdownTxt}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Account ── */}
        <Text style={st.sectionLabel}>Your account</Text>

        <View style={st.fieldGroup}>
          <Text style={st.label}>Email address</Text>
          <TextInput
            style={st.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={TEXT3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View style={st.fieldGroup}>
          <Text style={st.label}>Username</Text>
          <TextInput
            style={st.input}
            value={username}
            onChangeText={setUsername}
            placeholder="choose a username"
            placeholderTextColor={TEXT3}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={st.hint}>3–20 characters · letters, numbers, underscore only</Text>
        </View>

        <View style={st.fieldGroup}>
          <Text style={st.label}>Passphrase</Text>
          <PasswordField value={password} onChange={setPassword} />
          <Text style={st.hint}>Minimum 8 characters</Text>
        </View>

        <View style={st.fieldGroup}>
          <Text style={st.label}>Confirm passphrase</Text>
          <PasswordField value={confirm} onChange={setConfirm} onSubmit={handleRegister} />
        </View>

        {!!error && <Text style={st.error}>{error}</Text>}

        <TouchableOpacity style={[st.submit, { marginTop: 24 }, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
          <Text style={st.submitTxt}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.switchLink} onPress={onLogin}>
          <Text style={st.switchTxt}>Already have an account? <Text style={{ color: GOLD }}>Log in</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ── Root ───────────────────────────────────────────────────────────────── */
export default function LoginScreen({ navigation }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'

  return (
    <View style={st.page}>
      {mode === 'login' && (
        <LoginView
          onSuccess={u => navigation.onSuccess(u)}
          onSignup={() => setMode('signup')}
          onForgot={() => setMode('forgot')}
        />
      )}
      {mode === 'signup' && (
        <SignupView
          onSuccess={u => navigation.onSignupSuccess ? navigation.onSignupSuccess(u) : navigation.onSuccess(u)}
          onLogin={() => setMode('login')}
        />
      )}
      {mode === 'forgot' && (
        <ForgotPasswordView onBack={() => setMode('login')} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  page:       { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card:       { width: '100%', maxWidth: 420, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, padding: 44, paddingHorizontal: 40, position: 'relative' },
  goldAccent: { position: 'absolute', top: 0, left: 0, width: 40, height: 2, backgroundColor: GOLD },

  tag:        { fontFamily: MONO, color: TEXT3, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 16 },
  title:      { fontFamily: DISPLAY, color: TEXT, fontSize: 30, fontWeight: '400', letterSpacing: 0.5, marginBottom: 8, lineHeight: 36 },
  subtitle:   { fontFamily: MONO, color: TEXT2, fontSize: 13, lineHeight: 22, letterSpacing: 0.5, fontStyle: 'italic', marginBottom: 30 },

  sectionLabel: { fontFamily: MONO, fontSize: 9, color: TEXT3, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 14, marginTop: 8, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 8 },

  fieldGroup: { marginBottom: 20 },
  label:      { fontFamily: MONO, color: TEXT2, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  input:      { backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.22)', color: TEXT, fontFamily: MONO, fontSize: 14, paddingVertical: 10, paddingHorizontal: 2, letterSpacing: 1, outlineWidth: 0 },
  hint:       { fontFamily: MONO, fontSize: 10, color: TEXT3, letterSpacing: 0.5, marginTop: 5 },

  pwWrap:     { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.22)', backgroundColor: '#161616' },
  eyeBtn:     { paddingHorizontal: 10, paddingVertical: 10 },

  dropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#161616', borderWidth: 1, borderColor: BORDER, zIndex: 100 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.08)' },
  dropdownTxt:  { fontFamily: MONO, fontSize: 13, color: TEXT, letterSpacing: 0.5 },

  error:      { color: ERR, fontFamily: MONO, fontSize: 12, letterSpacing: 1, marginBottom: 12 },

  submit:     { width: '100%', marginTop: 8, paddingVertical: 13, backgroundColor: GOLD, alignItems: 'center' },
  submitTxt:  { color: BG, fontFamily: MONO, fontWeight: '700', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' },

  switchLink: { marginTop: 20, alignItems: 'center' },
  switchTxt:  { fontFamily: MONO, fontSize: 12, color: TEXT2, letterSpacing: 0.5 },
});
