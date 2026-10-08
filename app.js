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
        // Murid HANYA boleh melihat Step 3 (Dekripsi)
        document.querySelector('.step-nav').style.display = 'none';
        document.getElementById('step3-header').style.display = 'none';
        document.getElementById('alert-privkey').style.display = 'none';
        
        // Pindahkan tampilan awal langsung ke Step 3
        setTimeout(() => {
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step3').classList.add('active');
            
            const btnStep3 = document.querySelector('[data-target="step3"]');
            btnStep3.classList.add('active');
            btnStep3.disabled = false;
        }, 100); // timeout kecil memastikan DOM render selesai
    }

    // --- 3. Logika Logout ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        // Tampilkan email user yang sedang login
        const emailDisplay = document.getElementById('user-email-display');
        if(emailDisplay) emailDisplay.innerText = `${userEmail} (${userRole})`;

        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('crypxaminationState');
            window.location.href = "login.html";
        });
    }

    // --- 4. Navigation Handling Bawaan Aplikasi ---
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
    let publicKey = null;
    let privateKey = null;
    let subjects = {};
    let activeSubject = null;

    // --- State Persistence ---
    function saveState() {
        const state = {
            publicKey,
            privateKey,
            subjects,
            activeSubject
        };
        const serialized = JSON.stringify(state, (key, value) => 
            typeof value === 'bigint' ? { __type: 'bigint', value: value.toString() } : value
        );
        localStorage.setItem('crypxaminationState', serialized);

        // Sinkronisasi ke Supabase
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
            // Ambil dari Supabase
            const { data, error } = await supabase.from('app_state').select('data').eq('id', 1).single();
            
            let saved = data?.data;
            
            // Fallback ke local jika kosong
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
                    // Jika dari Supabase sudah berupa object (JSONB)
                    parsed = JSON.parse(JSON.stringify(saved), (key, value) => {
                        if (value && typeof value === 'object' && value.__type === 'bigint') {
                            return BigInt(value.value);
                        }
                        return value;
                    });
                }
                
                if (parsed.publicKey) publicKey = parsed.publicKey;
                if (parsed.privateKey) privateKey = parsed.privateKey;
                if (parsed.subjects) subjects = parsed.subjects;
                if (parsed.activeSubject) activeSubject = parsed.activeSubject;
                
                // Restore Step 1 UI
                if (publicKey && privateKey) {
                    document.getElementById('val-pub').innerText = `(${publicKey.e}, ${publicKey.n})`;
                    document.getElementById('val-priv').innerText = `(${privateKey.d}, ${privateKey.n})`;
                    document.getElementById('val-e').innerText = publicKey.e;
                    document.getElementById('val-n').innerText = publicKey.n;
                    document.getElementById('val-d').innerText = privateKey.d;
                    document.getElementById('val-n2').innerText = privateKey.n;
                    
                    document.getElementById('disp-pubkey').innerText = `(e=${publicKey.e}, n=${publicKey.n})`;
                    document.getElementById('disp-privkey').innerText = `(d=${privateKey.d}, n=${privateKey.n})`;

                    document.getElementById('keygen-results').classList.remove('hidden');

                    document.getElementById('nav-step2').disabled = false;
                    document.getElementById('nav-step3').disabled = false;
                }
                
                // Restore Step 2 & 3 UI
                renderSubjects();
                if (activeSubject) {
                    renderQnA();
                    renderEncryptionResult();
                }
                updateDropdowns();
                
            }
        } catch (e) {
            console.error("Gagal memuat state", e);
        }
    }

    // Step 1: Pembangkitan Kunci
    document.getElementById('btn-generate-primes').addEventListener('click', () => {
        const pInput = document.getElementById('input-p');
        const qInput = document.getElementById('input-q');
        
        pInput.value = generatePrime(250, 999); 
        let q = generatePrime(250, 999);
        while (q == pInput.value) q = generatePrime(250, 999);
        qInput.value = q;
    });

    document.getElementById('btn-generate-keys').addEventListener('click', () => {
        const p = parseInt(document.getElementById('input-p').value);
        const q = parseInt(document.getElementById('input-q').value);

        if (!p || !q) return alert("Masukkan p dan q");
        if (!isPrime(BigInt(p)) || !isPrime(BigInt(q))) return alert("p dan q harus bilangan prima!");

        try {
            const keys = generateKeys(p, q);
            publicKey = keys.publicKey;
            privateKey = keys.privateKey;

            // Reset data yang sudah terenkripsi dengan kunci lama
            Object.keys(subjects).forEach(sub => {
                subjects[sub].encryptionResult = null;
                subjects[sub].decryptResult = null;
            });
            renderEncryptionResult();
            updateDropdowns();

            document.getElementById('val-pub').innerText = `(${keys.e}, ${keys.n})`;
            document.getElementById('val-priv').innerText = `(${keys.d}, ${keys.n})`;
            document.getElementById('val-e').innerText = keys.e;
            document.getElementById('val-n').innerText = keys.n;
            document.getElementById('val-d').innerText = keys.d;
            document.getElementById('val-n2').innerText = keys.n;
            
            document.getElementById('disp-pubkey').innerText = `(e=${keys.e}, n=${keys.n})`;
            document.getElementById('disp-privkey').innerText = `(d=${privateKey.d}, n=${privateKey.n})`;

            document.getElementById('keygen-results').classList.remove('hidden');

            document.getElementById('nav-step2').disabled = false;
            document.getElementById('nav-step3').disabled = false;
            
            saveState();
        } catch (e) {
            alert("Error: " + e.message);
        }
    });

    // --- Filter State ---
    let encryptFilter = 'semua';
    let decryptFilter = 'semua';

    document.querySelectorAll('.filter-btn-enc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn-enc').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline');
            });
            e.target.classList.remove('btn-outline');
            e.target.classList.add('btn-primary');
            encryptFilter = e.target.dataset.filter;
            renderEncryptionResult();
        });
    });

    document.querySelectorAll('.filter-btn-dec').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn-dec').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline');
            });
            e.target.classList.remove('btn-outline');
            e.target.classList.add('btn-primary');
            decryptFilter = e.target.dataset.filter;
            
            const sub = document.getElementById('select-subject-decrypt').value;
            if (sub && subjects[sub] && subjects[sub].decryptResult) {
                renderDecryptLog(sub);
            }
        });
    });

    // --- Step 2 UI Logic ---
    const inputSubject = document.getElementById('input-subject');
    const btnAddSubject = document.getElementById('btn-add-subject');
    const subjectList = document.getElementById('subject-list');
    const cardSoal = document.getElementById('card-soal');
    const titleSoalMapel = document.getElementById('title-soal-mapel');
    const qnaContainer = document.getElementById('qna-container');
    const btnAddQnA = document.getElementById('btn-add-qna');

    function updateDropdowns() {
        const selectDecrypt = document.getElementById('select-subject-decrypt');
        const currentVal = selectDecrypt.value;
        
        selectDecrypt.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        
        Object.keys(subjects).forEach(sub => {
            if (subjects[sub].encryptionResult) {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.innerText = sub;
                selectDecrypt.appendChild(opt);
            }
        });

        if(subjects[currentVal] && subjects[currentVal].encryptionResult) {
            selectDecrypt.value = currentVal;
            // Jika ada decryptResult sebelumnya, render lagi
            if (subjects[currentVal].decryptResult) {
                document.getElementById('container-dekripsi-qna').style.display = 'block';
                document.getElementById('input-ciphertext-decrypt').value = subjects[currentVal].encryptionResult.ciphertext;
                renderPlaintextAndLog(currentVal);
            }
        }
        
        // Panggil event untuk me-refresh
        selectDecrypt.dispatchEvent(new Event('change'));
    }

    function renderSubjects() {
        subjectList.innerHTML = '';
        Object.keys(subjects).forEach(sub => {
            const pill = document.createElement('div');
            pill.className = `pill ${activeSubject === sub ? 'active' : ''}`;
            
            const checkIcon = activeSubject === sub ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';
            const unencryptedWarning = !subjects[sub].encryptionResult ? `<span style="color: #ef4444; font-size: 11px; margin-left: 5px;" title="Belum dienkripsi dengan kunci saat ini">⚠️</span>` : '';
            
            pill.innerHTML = `
                ${checkIcon}
                ${sub}
                ${unencryptedWarning}
                <span class="pill-close" data-sub="${sub}">&times;</span>
            `;
            
            pill.addEventListener('click', (e) => {
                if(e.target.classList.contains('pill-close')) {
                    delete subjects[sub];
                    // Remove all finished states for this subject across all users
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
                    renderEncryptionResult();
                    updateDropdowns();
                    saveState();
                } else {
                    activeSubject = sub;
                    renderSubjects();
                    renderQnA();
                    renderEncryptionResult();
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

    function renderEncryptionResult() {
        const resBox = document.getElementById('encrypt-results');
        if (!activeSubject || !subjects[activeSubject].encryptionResult) {
            resBox.classList.add('hidden');
            return;
        }

        const result = subjects[activeSubject].encryptionResult;
        const cats = result.charCategories;
        
        let filteredCiphertext = [];
        let filteredLog = [];
        
        const cipherArr = result.ciphertext.split(',');
        
        for (let i = 0; i < cats.length; i++) {
            if (encryptFilter === 'semua' || cats[i] === encryptFilter) {
                filteredCiphertext.push(cipherArr[i]);
                filteredLog.push(result.log[i]);
            }
        }
        
        document.getElementById('output-ciphertext').value = filteredCiphertext.join(',');
        renderLogBox('log-encrypt', filteredLog);
        resBox.classList.remove('hidden');
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
                subjects[activeSubject].encryptionResult = null;
                renderEncryptionResult();
                updateDropdowns();
                saveState();
            });
            aInput.addEventListener('input', (e) => {
                subjects[activeSubject].qna[index].a = e.target.value;
                subjects[activeSubject].encryptionResult = null;
                renderEncryptionResult();
                updateDropdowns();
                saveState();
            });

            if(qna.length > 1) {
                div.querySelector('.btn-remove').addEventListener('click', () => {
                    subjects[activeSubject].qna.splice(index, 1);
                    subjects[activeSubject].encryptionResult = null;
                    renderQnA();
                    renderEncryptionResult();
                    updateDropdowns();
                    saveState();
                });
            }

            qnaContainer.appendChild(div);
        });
    }

    btnAddSubject.addEventListener('click', () => {
        const sub = inputSubject.value.trim();
        if (sub && !subjects[sub]) {
            subjects[sub] = { qna: [{q: "", a: ""}], encryptionResult: null };
            activeSubject = sub;
            inputSubject.value = '';
            renderSubjects();
            renderQnA();
            renderEncryptionResult();
            updateDropdowns();
            saveState();
        }
    });

    btnAddQnA.addEventListener('click', () => {
        if(activeSubject) {
            subjects[activeSubject].qna.push({q: "", a: ""});
            subjects[activeSubject].encryptionResult = null;
            renderQnA();
            renderEncryptionResult();
            updateDropdowns();
            saveState();
        }
    });

    // Step 2: Enkripsi Soal & Jawaban
    document.getElementById('btn-encrypt-qna').addEventListener('click', () => {
        if (!activeSubject) return;
        
        // Filter out empty ones
        const validQnA = subjects[activeSubject].qna.filter(item => item.q.trim() !== '' || item.a.trim() !== '');
        
        if (validQnA.length === 0) return alert("Soal dan jawaban tidak boleh kosong semua!");
        if (!publicKey) return alert("Kunci belum dibangkitkan!");

        // Gabungkan menggunakan delimiter
        let plainArr = [];
        let charCategories = [];
        
        const DELIM_QNA = "_=_SEP_QNA_=_";
        const DELIM_ITEM = "_=_SEP_ITEM_=_";
        
        validQnA.forEach((item, index) => {
            plainArr.push(`${item.q}${DELIM_QNA}${item.a}`);
            
            for(let i=0; i<item.q.length; i++) charCategories.push('soal');
            for(let i=0; i<DELIM_QNA.length; i++) charCategories.push('separator');
            for(let i=0; i<item.a.length; i++) charCategories.push('jawaban');
            
            if (index < validQnA.length - 1) {
                for(let i=0; i<DELIM_ITEM.length; i++) charCategories.push('separator');
            }
        });
        
        const combinedPlaintext = plainArr.join(DELIM_ITEM);

        const result = encryptMessage(combinedPlaintext, publicKey.e, publicKey.n);
        result.charCategories = charCategories;
        subjects[activeSubject].encryptionResult = result;
        
        // Bersihkan state selesai murid karena soal baru saja diperbarui
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(`examFinished_${activeSubject}_`)) {
                localStorage.removeItem(key);
            }
        });
        
        renderEncryptionResult();
        updateDropdowns();
        saveState();
    });

    // --- Step 3 UI Logic ---
    const selectDecrypt = document.getElementById('select-subject-decrypt');
    const containerDekripsiQnA = document.getElementById('container-dekripsi-qna');
    
    selectDecrypt.addEventListener('change', (e) => {
        const sub = e.target.value;
        
        if (sub && subjects[sub] && subjects[sub].encryptionResult) {
            containerDekripsiQnA.style.display = 'block';
            
            if (userRole === 'guru') {
                document.getElementById('card-dekripsi-teacher').style.display = 'block';
                document.getElementById('card-student-confirm').style.display = 'none';
            } else if (userRole === 'murid') {
                document.getElementById('card-dekripsi-teacher').style.display = 'none';
                document.getElementById('card-student-confirm').style.display = 'block';
            }

            document.getElementById('input-ciphertext-decrypt').value = subjects[sub].encryptionResult.ciphertext;
            
            if (subjects[sub].decryptResult) {
                renderPlaintextAndLog(sub);
            } else {
                document.getElementById('decrypt-qna-results').classList.add('hidden');
            }
        } else {
            containerDekripsiQnA.style.display = 'none';
        }
    });



    document.getElementById('btn-start-exam')?.addEventListener('click', () => {
        const sub = selectDecrypt.value;
        if (!sub) return alert("Pilih mata pelajaran terlebih dahulu.");
        
        // Save the chosen subject to localStorage so the exam page knows what to load
        localStorage.setItem('activeExamSubject', sub);
        window.location.href = "exam.html";
    });


    function renderDecryptLog(sub) {
        const result = subjects[sub].decryptResult;
        const cats = subjects[sub].encryptionResult.charCategories;
        
        let filteredLog = [];
        
        for (let i = 0; i < cats.length; i++) {
            if (decryptFilter === 'semua' || cats[i] === decryptFilter) {
                filteredLog.push(result.log[i]);
            }
        }
        
        renderLogBox('log-decrypt-qna', filteredLog);
    }
    
    function renderPlaintextAndLog(sub) {
        const result = subjects[sub].decryptResult;
        const plaintext = result.plaintext;
        
        let displayHtml = '';
        
        if (plaintext.includes('_=_SEP_ITEM_=_') || plaintext.includes('_=_SEP_QNA_=_')) {
            const items = plaintext.split('_=_SEP_ITEM_=_');
            items.forEach((item, i) => {
                const [q, a] = item.split('_=_SEP_QNA_=_');
                displayHtml += `
                <div style="margin-bottom: 16px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px;" class="student-qna-item">
                    <p style="margin-bottom: 8px;"><strong>Soal ${i+1}:</strong> ${q || '-'}</p>
                    ${userRole === 'guru' 
                        ? `<p style="margin-bottom: 8px; color: #16a34a;"><strong>Kunci Jawaban ${i+1}:</strong> ${a || '-'}</p>` 
                        : ''}
                </div>`;
            });
        } else {
            displayHtml = `<div><p><strong>Teks Asli:</strong> ${plaintext}</p></div>`; 
        }

        document.getElementById('output-plaintext-qna').innerHTML = displayHtml;
        renderDecryptLog(sub);
        document.getElementById('decrypt-qna-results').classList.remove('hidden');
        
        const btnSubmit = document.getElementById('btn-submit-exam');
        if (btnSubmit) btnSubmit.style.display = 'block';
    }

    document.getElementById('btn-decrypt-qna').addEventListener('click', () => {
        const sub = selectDecrypt.value;
        const cipher = document.getElementById('input-ciphertext-decrypt').value;
        if (!cipher || !sub) return alert("Belum ada ciphertext.");
        
        const result = decryptMessage(cipher, privateKey.d, privateKey.n);
        subjects[sub].decryptResult = result;
        
        renderPlaintextAndLog(sub);
        saveState();
    });

    document.getElementById('btn-submit-exam')?.addEventListener('click', () => {
        if (!publicKey) return alert("Kunci publik tidak ditemukan!");
        const answerInputs = document.querySelectorAll('.student-answer-input');
        let studentAnswers = [];
        answerInputs.forEach(input => {
            const val = input.value.trim();
            studentAnswers.push(val === "" ? "kosong" : val);
        });
        
        const DELIM_ITEM = "_=_SEP_ITEM_=_";
        const combinedAnswers = studentAnswers.join(DELIM_ITEM);
        const result = encryptMessage(combinedAnswers, publicKey.e, publicKey.n);
        
        document.getElementById('output-student-ciphertext').value = result.ciphertext;
        document.getElementById('submit-exam-results').classList.remove('hidden');
    });

    // Panggil loadState() saat aplikasi pertama kali dimuat
    loadState();
});
