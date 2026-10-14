// app.js
import { supabase } from './supabaseConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Cek Autentikasi & Role ---
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    
    // Jika belum login, tendang kembali ke login.html
    if (!userRole) {
        window.location.href = "login.html";
        return;
    }

    // --- 2. Terapkan Pembatasan Akses (Role-Based Access Control) ---
    if (userRole === 'murid') {
        // Murid HANYA boleh melihat Step 3 (Dekripsi/Ujian)
        document.querySelector('.step-nav').style.display = 'none';
        document.getElementById('step3-header').style.display = 'block';
        document.getElementById('step3-header').querySelector('h2').innerText = 'Dashboard Murid';
        document.getElementById('step3-header').querySelector('p').innerText = 'Langkah 1: Kelola Kunci RSA. Langkah 2: Pilih Mata Pelajaran.';
        document.getElementById('alert-privkey').style.display = 'none';
        
        // Pindahkan tampilan awal langsung ke Step 3
        setTimeout(() => {
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step3').classList.add('active');
            
            const btnStep3 = document.querySelector('[data-target="step3"]');
            btnStep3.classList.add('active');
            btnStep3.disabled = false;
        }, 100);
    }

    // --- 3. Logika Logout ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        const emailDisplay = document.getElementById('user-email-display');
        if(emailDisplay) emailDisplay.innerText = `${userEmail} (${userRole})`;

        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('crypxaminationState');
            window.location.href = "login.html";
        });
    }

    // --- 4. Navigation Handling ---
    const navBtns = document.querySelectorAll('.step-btn');
    const sections = document.querySelectorAll('.step-content');

    function goToStep(targetId) {
        navBtns.forEach(btn => {
            if (btn.dataset.target === targetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        sections.forEach(sec => {
            if (sec.id === targetId) {
                sec.classList.add('active');
            } else {
                sec.classList.remove('active');
            }
        });
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!btn.disabled) {
                goToStep(btn.dataset.target);
            }
        });
    });

    function renderLogBox(elementId, logArray) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (logArray.length <= 5) {
            el.innerHTML = logArray.join('\n');
        } else {
            const preview = logArray.slice(0, 5).join('\n');
            el.innerHTML = `${preview}\n<a href="#" class="expand-log-btn" style="color: #93c5fd; text-decoration: underline; cursor: pointer;">... klik untuk lihat semua (${logArray.length} operasi)</a>`;
            
            el.querySelector('.expand-log-btn').addEventListener('click', (e) => {
                e.preventDefault();
                el.innerHTML = logArray.join('\n');
            });
        }
    }

    // --- State Variables ---
    let subjects = {};
    let activeSubject = null;
    let studentKeys = {}; // { email: { publicKey: {e, n}, registeredAt } }

    function checkStudentKeyStatus() {
        if (userRole !== 'murid') return;
        
        if (studentKeys && studentKeys[userEmail]) {
            document.getElementById('card-murid-keygen').style.display = 'none';
            document.getElementById('card-murid-has-keys').style.display = 'block';
            const pk = studentKeys[userEmail].publicKey;
            document.getElementById('disp-reg-pubkey').innerText = `(${pk.e}, ${pk.n})`;
        } else {
            document.getElementById('card-murid-keygen').style.display = 'block';
            document.getElementById('card-murid-has-keys').style.display = 'none';
        }
    }

    // Keygen Logic for Dashboard Murid
    const btnRandomPrimes = document.getElementById('btn-student-random-primes');
    const btnGenerateKeys = document.getElementById('btn-student-generate-keys');
    const btnRegisterPubkey = document.getElementById('btn-register-pubkey');
    const btnShowKeygenAgain = document.getElementById('btn-show-keygen-again');

    btnRandomPrimes?.addEventListener('click', () => {
        document.getElementById('input-student-p').value = generatePrime(250, 999);
        let q = generatePrime(250, 999);
        while (q == document.getElementById('input-student-p').value) q = generatePrime(250, 999);
        document.getElementById('input-student-q').value = q;
    });

    btnGenerateKeys?.addEventListener('click', () => {
        const p = parseInt(document.getElementById('input-student-p').value);
        const q = parseInt(document.getElementById('input-student-q').value);
        if (!p || !q) return alert("Masukkan p dan q");
        if (!isPrime(BigInt(p)) || !isPrime(BigInt(q))) return alert("⚠️ p dan q HARUS merupakan Bilangan Prima!\n\nJika p dan q bukan bilangan prima, maka rumus dekripsi (membuka gembok) akan gagal secara matematis dan hanya menghasilkan karakter acak (gibberish).");
        if (p === q) return alert("p dan q tidak boleh sama!");
        
        try {
            const keys = generateKeys(p, q);
            document.getElementById('student-val-pub').innerText = `(${keys.e}, ${keys.n})`;
            document.getElementById('student-val-priv').innerText = `(${keys.d}, ${keys.n})`;
            document.getElementById('student-keygen-results').classList.remove('hidden');
            
            btnRegisterPubkey.dataset.e = keys.e;
            btnRegisterPubkey.dataset.n = keys.n;
            btnRegisterPubkey.dataset.d = keys.d;
        } catch (e) { alert("Error: " + e.message); }
    });

    btnRegisterPubkey?.addEventListener('click', () => {
        const e = btnRegisterPubkey.dataset.e;
        const n = btnRegisterPubkey.dataset.n;
        const d = btnRegisterPubkey.dataset.d;
        if (!e || !n) return;
        
        if (!studentKeys) studentKeys = {};
        studentKeys[userEmail] = {
            publicKey: { e, n },
            registeredAt: new Date().toISOString()
        };
        
        localStorage.setItem(`myKeys_${userEmail}`, JSON.stringify({ e, n, d }));
        saveState();
        
        alert("Kunci Publik berhasil didaftarkan!\nKunci Privat Anda juga telah disimpan di browser ini.");
        checkStudentKeyStatus();
    });

    btnShowKeygenAgain?.addEventListener('click', () => {
        if (confirm("⚠️ PERINGATAN: Jika Anda mendaftarkan kunci baru, soal ujian yang sudah dienkripsi dengan kunci lama tidak akan bisa dibuka. Lanjutkan?")) {
            document.getElementById('card-murid-has-keys').style.display = 'none';
            document.getElementById('card-murid-keygen').style.display = 'block';
        }
    });

    // --- State Persistence ---
    function saveState() {
        const state = {
            subjects,
            activeSubject,
            studentKeys
        };
        const serialized = JSON.stringify(state, (key, value) => 
            typeof value === 'bigint' ? { __type: 'bigint', value: value.toString() } : value
        );
        localStorage.setItem('crypxaminationState', serialized);

        supabase.from('app_state')
            .upsert({ id: 1, data: serialized })
            .then(({error}) => {
                if (error) {
                    console.error("Gagal sinkronisasi ke Supabase", error);
                    alert("⚠️ PERINGATAN: Gagal menyimpan data ke Supabase!\n\nKemungkinan besar tabel 'app_state' belum dibuat, atau Row Level Security (RLS) di Supabase memblokir akses. Data saat ini hanya tersimpan sementara di memori browser.");
                }
            });
    }

    async function loadState() {
        try {
            const { data, error } = await supabase.from('app_state').select('data').eq('id', 1).single();
            
            let saved = data?.data;
            
            if (!saved || saved === '{}' || (typeof saved === 'object' && Object.keys(saved).length === 0)) {
                saved = localStorage.getItem('crypxaminationState');
            }

            if (saved) {
                let parsed;
                if (typeof saved === 'string') {
                    parsed = JSON.parse(saved, (key, value) => {
                        if (value && typeof value === 'object' && value.__type === 'bigint') {
                            return BigInt(value.value);
                        }
                        return value;
                    });
                } else {
                    parsed = JSON.parse(JSON.stringify(saved), (key, value) => {
                        if (value && typeof value === 'object' && value.__type === 'bigint') {
                            return BigInt(value.value);
                        }
                        return value;
                    });
                }
                
                if (parsed.subjects) subjects = parsed.subjects;
                if (parsed.activeSubject) activeSubject = parsed.activeSubject;
                if (parsed.studentKeys) studentKeys = parsed.studentKeys;
                
                // Restore UI
                renderSubjects();
                if (activeSubject) {
                    renderQnA();
                }
                updatePKIDropdown();
                updateStep3Dropdown();
                checkStudentKeyStatus();
                
                // Enable steps if there are subjects with QnA
                if (Object.keys(subjects).length > 0) {
                    document.getElementById('nav-step2').disabled = false;
                    document.getElementById('nav-step3').disabled = false;
                }
            }
        } catch (e) {
            console.error("Gagal memuat state", e);
        }
    }

    // --- Step 1 UI Logic: Input Soal ---
    const inputSubject = document.getElementById('input-subject');
    const btnAddSubject = document.getElementById('btn-add-subject');
    const subjectList = document.getElementById('subject-list');
    const cardSoal = document.getElementById('card-soal');
    const titleSoalMapel = document.getElementById('title-soal-mapel');
    const qnaContainer = document.getElementById('qna-container');
    const btnAddQnA = document.getElementById('btn-add-qna');
    const btnSaveQnA = document.getElementById('btn-save-qna');

    function updatePKIDropdown() {
        const select = document.getElementById('select-subject-encrypt-pki');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        
        Object.keys(subjects).forEach(sub => {
            if (subjects[sub].qna && subjects[sub].qna.some(item => item.q.trim() !== '' || item.a.trim() !== '')) {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.innerText = sub;
                select.appendChild(opt);
            }
        });

        if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        }
    }

    function updateStep3Dropdown() {
        const selectDecrypt = document.getElementById('select-subject-decrypt');
        if (!selectDecrypt) return;
        const currentVal = selectDecrypt.value;
        
        selectDecrypt.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        
        Object.keys(subjects).forEach(sub => {
            if (subjects[sub].qna && subjects[sub].qna.some(item => item.q.trim() !== '' || item.a.trim() !== '')) {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.innerText = sub;
                selectDecrypt.appendChild(opt);
            }
        });

        if (currentVal && selectDecrypt.querySelector(`option[value="${currentVal}"]`)) {
            selectDecrypt.value = currentVal;
        }
        
        selectDecrypt.dispatchEvent(new Event('change'));
    }

    function renderSubjects() {
        subjectList.innerHTML = '';
        Object.keys(subjects).forEach(sub => {
            const pill = document.createElement('div');
            pill.className = `pill ${activeSubject === sub ? 'active' : ''}`;
            
            const checkIcon = activeSubject === sub ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';
            
            pill.innerHTML = `
                ${checkIcon}
                ${sub}
                <span class="pill-close" data-sub="${sub}">&times;</span>
            `;
            
            pill.addEventListener('click', (e) => {
                if(e.target.classList.contains('pill-close')) {
                    delete subjects[sub];
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith(`examFinished_${sub}_`)) {
                            localStorage.removeItem(key);
                        }
                    });
                    if(activeSubject === sub) {
                        const remaining = Object.keys(subjects);
                        activeSubject = remaining.length > 0 ? remaining[0] : null;
                    }
                    renderSubjects();
                    renderQnA();
                    updatePKIDropdown();
                    updateStep3Dropdown();
                    saveState();
                } else {
                    activeSubject = sub;
                    renderSubjects();
                    renderQnA();
                    saveState();
                }
            });
            subjectList.appendChild(pill);
        });

        if (activeSubject) {
            cardSoal.style.display = 'block';
            titleSoalMapel.innerText = `Data Ujian — ${activeSubject}`;
        } else {
            cardSoal.style.display = 'none';
        }
    }

    function renderQnA() {
        qnaContainer.innerHTML = '';
        if (!activeSubject) return;

        const qna = subjects[activeSubject].qna;
        if (qna.length === 0) qna.push({q: "", a: ""});

        qna.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            div.style.marginBottom = '20px';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="margin: 0; font-weight: 600; color: #1e293b;">Soal & Jawaban ${index + 1}</label>
                    ${qna.length > 1 ? `<button class="btn-remove" data-index="${index}">Hapus</button>` : ''}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <textarea class="q-input" rows="3" placeholder="Ketik soal di sini...">${item.q}</textarea>
                    </div>
                    <div>
                        <textarea class="a-input" rows="3" placeholder="Ketik jawaban di sini...">${item.a}</textarea>
                    </div>
                </div>
            `;
            
            const qInput = div.querySelector('.q-input');
            const aInput = div.querySelector('.a-input');
            
            qInput.addEventListener('input', (e) => {
                subjects[activeSubject].qna[index].q = e.target.value;
                saveState();
            });
            aInput.addEventListener('input', (e) => {
                subjects[activeSubject].qna[index].a = e.target.value;
                saveState();
            });

            if(qna.length > 1) {
                div.querySelector('.btn-remove').addEventListener('click', () => {
                    subjects[activeSubject].qna.splice(index, 1);
                    renderQnA();
                    saveState();
                });
            }

            qnaContainer.appendChild(div);
        });
    }

    btnAddSubject.addEventListener('click', () => {
        const sub = inputSubject.value.trim();
        if (sub && !subjects[sub]) {
            subjects[sub] = { qna: [{q: "", a: ""}] };
            activeSubject = sub;
            inputSubject.value = '';
            renderSubjects();
            renderQnA();
            updatePKIDropdown();
            
            document.getElementById('nav-step2').disabled = false;
            document.getElementById('nav-step3').disabled = false;
            
            saveState();
        }
    });

    btnAddQnA.addEventListener('click', () => {
        if(activeSubject) {
            subjects[activeSubject].qna.push({q: "", a: ""});
            renderQnA();
            saveState();
        }
    });

    btnSaveQnA?.addEventListener('click', () => {
        if(activeSubject) {
            saveState();
            updatePKIDropdown();
            alert("Soal dan jawaban berhasil disimpan!");
        }
    });

    // --- Step 2: PKI Encryption ---
    const selectEncryptPKI = document.getElementById('select-subject-encrypt-pki');
    
    selectEncryptPKI?.addEventListener('change', (e) => {
        const sub = e.target.value;
        const cardStudentKeys = document.getElementById('card-student-keys');
        
        if (sub && subjects[sub]) {
            cardStudentKeys.style.display = 'block';
            renderStudentKeysList(sub);
        } else {
            cardStudentKeys.style.display = 'none';
        }
    });

    function renderStudentKeysList(sub) {
        const listContainer = document.getElementById('student-keys-list');
        listContainer.innerHTML = '';
        
        const keys = Object.keys(studentKeys);
        
        if (keys.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #64748b;">
                    <p>Belum ada siswa yang mendaftarkan Kunci Publik mereka.</p>
                    <p style="font-size: 13px;">Siswa harus membuka halaman ujian dan men-generate kunci terlebih dahulu.</p>
                </div>
            `;
            return;
        }

        keys.forEach(email => {
            const sk = studentKeys[email];
            const encData = subjects[sub]?.encryptedForStudents?.[email];
            let statusBadge = '';
            
            if (encData) {
                if (encData.publicKeyUsed && (encData.publicKeyUsed.e !== sk.publicKey.e || encData.publicKeyUsed.n !== sk.publicKey.n)) {
                    statusBadge = `<span style="font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 4px; background: #ef4444; color: white;">⚠️ KUNCI BERUBAH (Enkripsi Ulang!)</span>`;
                } else {
                    statusBadge = `<span style="font-size: 12px; padding: 4px 8px; border-radius: 4px; background: #dcfce7; color: #16a34a;">✓ Terenkripsi</span>`;
                }
            } else {
                statusBadge = `<span style="font-size: 12px; padding: 4px 8px; border-radius: 4px; background: #fef3c7; color: #ca8a04;">⏳ Menunggu</span>`;
            }

            const div = document.createElement('div');
            div.style.cssText = 'padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px;';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #1e293b;">${email}</strong>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #64748b; font-family: monospace;">
                            Kunci Publik: (e=${sk.publicKey.e}, n=${sk.publicKey.n})
                        </p>
                    </div>
                    ${statusBadge}
                </div>
            `;
            listContainer.appendChild(div);
        });

        // Show existing per-student results if any
        if (subjects[sub]?.encryptedForStudents && Object.keys(subjects[sub].encryptedForStudents).length > 0) {
            renderPerStudentCiphertexts(sub);
        }
    }

    function renderPerStudentCiphertexts(sub) {
        const container = document.getElementById('per-student-ciphertext-list');
        container.innerHTML = '';
        
        const encrypted = subjects[sub].encryptedForStudents;
        Object.keys(encrypted).forEach(email => {
            const div = document.createElement('div');
            div.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;';
            div.innerHTML = `
                <p style="margin: 0 0 6px; font-weight: 600; color: #0369a1;">${email}</p>
                <p style="margin: 0; font-size: 12px; font-family: monospace; word-break: break-all; color: #64748b; max-height: 60px; overflow-y: auto;">
                    ${encrypted[email].ciphertext}
                </p>
            `;
            container.appendChild(div);
        });

        document.getElementById('encrypt-pki-results').classList.remove('hidden');
    }

    document.getElementById('btn-encrypt-per-student')?.addEventListener('click', () => {
        const sub = selectEncryptPKI.value;
        if (!sub) return alert("Pilih mata pelajaran terlebih dahulu.");
        
        const keys = Object.keys(studentKeys);
        if (keys.length === 0) return alert("Belum ada siswa yang mendaftarkan Kunci Publik!");

        const validQnA = subjects[sub].qna.filter(item => item.q.trim() !== '' || item.a.trim() !== '');
        if (validQnA.length === 0) return alert("Soal dan jawaban tidak boleh kosong!");

        // Gabungkan soal menjadi satu plaintext
        const DELIM_QNA = "_=_SEP_QNA_=_";
        const DELIM_ITEM = "_=_SEP_ITEM_=_";
        
        let plainArr = [];
        validQnA.forEach(item => {
            plainArr.push(`${item.q}${DELIM_QNA}${item.a}`);
        });
        const combinedPlaintext = plainArr.join(DELIM_ITEM);

        // Enkripsi untuk setiap siswa menggunakan Kunci Publik masing-masing
        if (!subjects[sub].encryptedForStudents) subjects[sub].encryptedForStudents = {};

        keys.forEach(email => {
            const studentPubKey = studentKeys[email].publicKey;
            const result = encryptMessage(combinedPlaintext, studentPubKey.e, studentPubKey.n);
            
            subjects[sub].encryptedForStudents[email] = {
                ciphertext: result.ciphertext,
                publicKeyUsed: studentPubKey
            };
        });

        // Bersihkan state selesai murid karena soal baru saja diperbarui
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(`examFinished_${sub}_`)) {
                localStorage.removeItem(key);
            }
        });

        renderStudentKeysList(sub);
        renderPerStudentCiphertexts(sub);
        updateStep3Dropdown();
        saveState();
        
        alert(`Soal berhasil dienkripsi untuk ${keys.length} siswa!`);
    });

    // --- Step 3 UI Logic ---
    const selectDecrypt = document.getElementById('select-subject-decrypt');
    const containerDekripsiQnA = document.getElementById('container-dekripsi-qna');
    
    selectDecrypt?.addEventListener('change', (e) => {
        const sub = e.target.value;
        
        if (sub && subjects[sub]) {
            containerDekripsiQnA.style.display = 'block';
            
            if (userRole === 'guru') {
                document.getElementById('card-dekripsi-teacher').style.display = 'block';
                document.getElementById('card-student-confirm').style.display = 'none';

                // Show per-student ciphertexts in teacher view
                const cipherDisplay = document.getElementById('input-ciphertext-decrypt');
                const encrypted = subjects[sub].encryptedForStudents || {};
                const emails = Object.keys(encrypted);
                if (emails.length > 0) {
                    cipherDisplay.value = emails.map(e => `[${e}]: ${encrypted[e].ciphertext.substring(0, 80)}...`).join('\n');
                } else {
                    cipherDisplay.value = "Belum ada soal yang dienkripsi untuk siswa.";
                }
            } else if (userRole === 'murid') {
                document.getElementById('card-dekripsi-teacher').style.display = 'none';
                document.getElementById('card-student-confirm').style.display = 'block';
            }
        } else {
            containerDekripsiQnA.style.display = 'none';
        }
    });

    document.getElementById('btn-start-exam')?.addEventListener('click', () => {
        const sub = selectDecrypt.value;
        if (!sub) return alert("Pilih mata pelajaran terlebih dahulu.");
        
        localStorage.setItem('activeExamSubject', sub);
        window.location.href = "exam.html";
    });

    document.getElementById('btn-decrypt-qna')?.addEventListener('click', () => {
        const sub = selectDecrypt.value;
        if (!sub) return alert("Pilih mata pelajaran terlebih dahulu.");
        
        // For teacher, we don't auto-decrypt anymore. Show info about per-student encryption.
        const outputContainer = document.getElementById('output-plaintext-qna');
        if (!outputContainer) return;
        
        const encrypted = subjects[sub].encryptedForStudents || {};
        let html = '';
        
        if (Object.keys(encrypted).length === 0) {
            html = '<p>Belum ada soal yang dienkripsi.</p>';
        } else {
            Object.keys(encrypted).forEach(email => {
                const sk = studentKeys[email];
                html += `
                    <div style="margin-bottom: 16px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px;">
                        <p style="margin-bottom: 8px;"><strong>${email}</strong></p>
                        <p style="margin-bottom: 4px; font-size: 12px; color: #64748b;">Kunci Publik: (e=${sk?.publicKey?.e}, n=${sk?.publicKey?.n})</p>
                        <p style="margin: 0; font-size: 12px; font-family: monospace; word-break: break-all; color: #94a3b8; max-height: 40px; overflow-y: auto;">
                            Ciphertext: ${encrypted[email].ciphertext.substring(0, 120)}...
                        </p>
                    </div>
                `;
            });
        }
        
        outputContainer.innerHTML = html;
        document.getElementById('decrypt-qna-results').classList.remove('hidden');
    });

    // Panggil loadState() saat aplikasi pertama kali dimuat
    loadState();
});
