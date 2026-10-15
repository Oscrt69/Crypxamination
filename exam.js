import { supabase } from './supabaseConfig.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Authentication Check
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');

    if (!userRole) {
        window.location.href = "login.html";
        return;
    }

    document.getElementById('user-email-display').innerText = `${userEmail} (${userRole})`;

    document.getElementById('btn-back-home').addEventListener('click', () => {
        window.location.href = "index.html";
    });

    // State Variables
    let subjects = {};
    let activeSubject = localStorage.getItem('activeExamSubject');
    let studentPublicKey = null; // Kunci publik siswa ini

    if (!activeSubject) {
        alert("Tidak ada mata pelajaran yang dipilih.");
        window.location.href = "index.html";
        return;
    }

    document.getElementById('exam-title-2').innerText = `Mata Pelajaran: ${activeSubject}`;

    // --- Load State and Check Status ---
    // Tugasnya memeriksa apakah siswa sudah punya kunci publik.
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

                subjects = parsed.subjects || {};

                // Cek apakah siswa ini sudah mendaftarkan kunci publik
                const studentKeys = parsed.studentKeys || {};
                if (studentKeys[userEmail]) {
                    studentPublicKey = studentKeys[userEmail].publicKey;
                    showMyKeysCard(studentPublicKey);
                    checkExamAvailability(parsed);
                } else {
                    // Jika belum, kembalikan ke dashboard
                    alert("Anda belum mendaftarkan Kunci Publik. Silakan daftarkan di Dashboard.");
                    window.location.href = "index.html";
                }
            } else {
                alert("Data ujian tidak ditemukan.");
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Gagal memuat state", e);
            alert("Terjadi kesalahan saat memuat data ujian.");
        }
    }

    // Tugasnya memeriksa apakah soal sudah tersedia atau belum.
    function checkExamAvailability(appState) {
        const subjectData = appState.subjects?.[activeSubject];

        if (!subjectData) {
            alert("Mata pelajaran tidak ditemukan.");
            window.location.href = "index.html";
            return;
        }

        // Cek apakah guru sudah mengenkripsi soal khusus untuk siswa ini
        const encForMe = subjectData.encryptedForStudents?.[userEmail];

        if (encForMe) {
            // Cek apakah sudah pernah mengerjakan
            const savedResultStr = localStorage.getItem(`examFinished_${activeSubject}_${userEmail}`);
            if (savedResultStr) {
                try {
                    const savedData = JSON.parse(savedResultStr);
                    if (savedData.ciphertext === encForMe.ciphertext) {
                        encryptedResultData = savedData.results;
                        showSection('section-result');
                        renderEncryptedResult();
                        return;
                    } else {
                        localStorage.removeItem(`examFinished_${activeSubject}_${userEmail}`);
                    }
                } catch (e) {
                    localStorage.removeItem(`examFinished_${activeSubject}_${userEmail}`);
                }
            }

            // Soal tersedia, tampilkan halaman ujian
            currentCiphertext = encForMe.ciphertext;
            showSection('section-exam');

            // Cek apakah kunci yang digunakan untuk enkripsi SAMA dengan kunci murid saat ini
            let keyMismatchWarning = '';
            if (encForMe.publicKeyUsed && (encForMe.publicKeyUsed.e !== studentPublicKey.e || encForMe.publicKeyUsed.n !== studentPublicKey.n)) {
                keyMismatchWarning = `
                    <div class="alert alert-warning mt-3" style="border: 2px solid #ef4444; background-color: #fef2f2; color: #b91c1c;">
                        <h4 style="margin: 0 0 10px 0;">⚠️ PERHATIAN: KUNCI TIDAK COCOK!</h4>
                        <p style="margin: 0 0 10px 0;">Soal ini <strong>sudah terlanjur dienkripsi menggunakan Kunci Publik lama Anda</strong> <code>(e=${encForMe.publicKeyUsed.e}, n=${encForMe.publicKeyUsed.n})</code>.</p>
                        <p style="margin: 0;">Sedangkan Kunci Publik Anda saat ini adalah <code>(e=${studentPublicKey.e}, n=${studentPublicKey.n})</code>.</p>
                        <p style="margin: 10px 0 0 0; font-weight: bold;">SOLUSI: Silakan beritahu Guru Anda untuk menekan tombol "Enkripsi Soal untuk Semua Siswa" kembali agar soal ini dienkripsi dengan kunci baru Anda.</p>
                    </div>
                `;
            }

            const container = document.getElementById('exam-questions-container');
            container.innerHTML = `
                <div style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; word-break: break-all; color: #64748b; font-size: 13px; font-family: monospace;">
                    <strong>Soal Ujian Terenkripsi (khusus untuk ${userEmail}):</strong><br><br>
                    ${encForMe.ciphertext}
                </div>
                ${keyMismatchWarning}
                <p style="margin-top: 15px; font-size: 14px; color: #64748b; font-weight: 500;">
                    Masukkan Kunci Privat Anda di atas untuk mendekripsi soal ini.
                </p>
            `;
        } else {
            // Guru belum mengenkripsi soal untuk siswa ini
            showSection('section-waiting');
        }
    }

    // Tugasnya menampilkan bagian halaman yang diinginkan. 
    function showSection(sectionId) {
        ['section-keygen', 'section-exam', 'section-result', 'section-waiting'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = id === sectionId ? 'block' : 'none';
                if (id === sectionId) el.classList.add('active');
                else el.classList.remove('active');
            }
        });
    }

    // --- Refresh/Reload button ---
    document.getElementById('btn-refresh-state')?.addEventListener('click', () => {
        window.location.reload();
    });

    // Menampilkan kunci publik dan kunci privat milik siswa jika tersimpan di perangkat.
    function showMyKeysCard(appStatePub) {
        const savedKeysStr = localStorage.getItem(`myKeys_${userEmail}`);
        if (savedKeysStr) {
            try {
                const k = JSON.parse(savedKeysStr);
                document.getElementById('card-my-keys').style.display = 'block';
                document.getElementById('disp-my-pub').innerText = `(${k.e}, ${k.n})`;
                document.getElementById('disp-my-priv').innerText = `(${k.d}, ${k.n})`;

                // Autofill decrypt inputs for convenience
                // const inputDSoal = document.getElementById('input-decrypt-soal-d');
                // const inputNSoal = document.getElementById('input-decrypt-soal-n');
                // if(inputDSoal && !inputDSoal.value) inputDSoal.value = k.d;
                // if(inputNSoal && !inputNSoal.value) inputNSoal.value = k.n;
                // 
                // const inputDRes = document.getElementById('input-decrypt-result-d');
                // const inputNRes = document.getElementById('input-decrypt-result-n');
                // if(inputDRes && !inputDRes.value) inputDRes.value = k.d;
                // if(inputNRes && !inputNRes.value) inputNRes.value = k.n;
            } catch (e) { }
        } else if (appStatePub) {
            document.getElementById('card-my-keys').style.display = 'block';
            document.getElementById('disp-my-pub').innerText = `(${appStatePub.e}, ${appStatePub.n})`;
            document.getElementById('disp-my-priv').innerText = `(Tidak tersimpan di perangkat ini)`;
        }
    }

    document.getElementById('btn-toggle-keys')?.addEventListener('click', (e) => {
        const content = document.getElementById('my-keys-content');
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            e.target.innerText = 'Sembunyikan Kunci';
        } else {
            content.classList.add('hidden');
            e.target.innerText = 'Tampilkan Kunci';
        }
    });

    // --- Exam Logic ---
    let currentQuestions = [];
    let currentAnswers = [];
    let currentCiphertext = '';
    let encryptedResultData = [];

    // Tugasnya menampilkan hasil yang sudah dienkripsi.    
    function renderEncryptedResult() {
        const resultContainer = document.getElementById('result-encrypted-container');
        resultContainer.innerHTML = '';

        encryptedResultData.forEach((data, i) => {
            const div = document.createElement('div');
            div.style.marginBottom = '15px';
            div.style.padding = '10px';
            div.style.background = '#f8fafc';
            div.style.borderRadius = '6px';
            div.style.border = '1px solid #e2e8f0';

            div.innerHTML = `
                <p style="margin: 0 0 5px 0; font-size: 14px; word-break: break-all;"><strong>Soal ${i + 1}:</strong> <span style="color: #64748b;">${data.encQ}</span></p>
                <p style="margin: 0; font-size: 14px; word-break: break-all;"><strong>Kunci Jawaban:</strong> <span style="color: #64748b;">${data.encA}</span></p>
            `;
            resultContainer.appendChild(div);
        });
    }

    // Decrypt Questions with student's private key
    document.getElementById('btn-decrypt-soal')?.addEventListener('click', () => {
        const dVal = document.getElementById('input-decrypt-soal-d').value.trim();
        const nVal = document.getElementById('input-decrypt-soal-n').value.trim();

        if (!dVal || !nVal) return alert("Masukkan nilai d dan n terlebih dahulu.");

        try {
            const result = decryptMessage(currentCiphertext, dVal, nVal);
            const plaintext = result.plaintext;

            if (plaintext.includes('_=_SEP_ITEM_=_') || plaintext.includes('_=_SEP_QNA_=_')) {
                const items = plaintext.split('_=_SEP_ITEM_=_');
                const container = document.getElementById('exam-questions-container');
                container.innerHTML = '';

                currentQuestions = [];
                currentAnswers = [];

                items.forEach((item, i) => {
                    const [q, a] = item.split('_=_SEP_QNA_=_');
                    currentQuestions.push(q);
                    currentAnswers.push(a);

                    const div = document.createElement('div');
                    div.style.marginBottom = '20px';
                    div.style.borderBottom = '1px dashed #cbd5e1';
                    div.style.paddingBottom = '15px';
                    div.innerHTML = `
                        <p style="margin-bottom: 10px; font-weight: 500;">
                            <strong>Soal ${i + 1}:</strong> 
                            <span>${q || '-'}</span>
                        </p>
                        <div>
                            <label style="font-size: 13px; font-weight: 600; color: #475569;">Jawaban Anda:</label>
                            <textarea class="student-answer-input" data-index="${i}" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 6px;"></textarea>
                        </div>
                    `;
                    container.appendChild(div);
                });

                document.getElementById('card-decrypt-soal').style.display = 'none';
                document.getElementById('btn-finish-exam').style.display = 'block';
            } else {
                // Kunci salah → tampilkan teks rusak namun dalam format lembar soal
                const container = document.getElementById('exam-questions-container');
                container.innerHTML = '';

                currentQuestions = [];
                currentAnswers = [];

                const numQuestions = subjects[activeSubject]?.qna?.length || 1;
                const chunkLen = Math.max(1, Math.floor(plaintext.length / numQuestions));

                for (let i = 0; i < numQuestions; i++) {
                    const garbledQ = plaintext.substring(i * chunkLen, (i + 1) * chunkLen) || plaintext;
                    currentQuestions.push(garbledQ);
                    currentAnswers.push("wrong_key");

                    const div = document.createElement('div');
                    div.style.marginBottom = '20px';
                    div.style.borderBottom = '1px dashed #cbd5e1';
                    div.style.paddingBottom = '15px';
                    div.innerHTML = `
                        <p style="margin-bottom: 10px; font-weight: 500;">
                            <strong>Soal ${i + 1}:</strong> 
                            <span style="word-break: break-all; font-family: monospace; color: #ef4444;">${garbledQ || '-'}</span>
                        </p>
                        <div>
                            <label style="font-size: 13px; font-weight: 600; color: #475569;">Jawaban Anda:</label>
                            <textarea class="student-answer-input" data-index="${i}" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 6px;"></textarea>
                        </div>
                    `;
                    container.appendChild(div);
                }

                document.getElementById('card-decrypt-soal').style.display = 'none';
                document.getElementById('btn-finish-exam').style.display = 'block';
            }
        } catch (e) {
            alert("Terjadi kesalahan. Pastikan d dan n berupa angka valid!");
        }
    });

    // Finish Exam — encrypt results using student's OWN public key
    document.getElementById('btn-finish-exam').addEventListener('click', () => {
        if (!confirm("Apakah Anda yakin ingin menyelesaikan ujian?")) return;
        if (!studentPublicKey) return alert("Kunci Publik tidak ditemukan!");

        const inputs = document.querySelectorAll('.student-answer-input');
        const studentAnswers = [];
        inputs.forEach(input => {
            const val = input.value.trim();
            studentAnswers.push(val === "" ? "kosong" : val);
        });

        encryptedResultData = [];

        currentQuestions.forEach((q, i) => {
            const a = currentAnswers[i];
            const sa = studentAnswers[i];

            // Encrypt using STUDENT'S OWN public key
            const encQ = encryptMessage(q, studentPublicKey.e, studentPublicKey.n).ciphertext;
            const encA = encryptMessage(a, studentPublicKey.e, studentPublicKey.n).ciphertext;
            const encSA = encryptMessage(sa, studentPublicKey.e, studentPublicKey.n).ciphertext;

            encryptedResultData.push({
                encQ: encQ, encA: encA, encSA: encSA
            });
        });

        const dataToSave = {
            ciphertext: currentCiphertext,
            results: encryptedResultData
        };
        localStorage.setItem(`examFinished_${activeSubject}_${userEmail}`, JSON.stringify(dataToSave));

        showSection('section-result');
        renderEncryptedResult();
    });

    // Decrypt Results
    document.getElementById('btn-decrypt-result').addEventListener('click', () => {
        const dVal = document.getElementById('input-decrypt-result-d').value.trim();
        const nVal = document.getElementById('input-decrypt-result-n').value.trim();

        if (!dVal || !nVal) return alert("Masukkan nilai d dan n terlebih dahulu.");

        try {
            const decContainer = document.getElementById('result-decrypted-container');
            decContainer.innerHTML = '<h4 style="margin-top:0;">Hasil Dekripsi</h4>';

            encryptedResultData.forEach((data, i) => {
                const decQ = decryptMessage(data.encQ, dVal, nVal).plaintext;
                const decA = decryptMessage(data.encA, dVal, nVal).plaintext;
                const decSA = decryptMessage(data.encSA, dVal, nVal).plaintext;

                const isCorrect = decA.toLowerCase().trim() === decSA.toLowerCase().trim();
                const color = isCorrect ? '#16a34a' : '#ef4444';

                const div = document.createElement('div');
                div.style.marginBottom = '15px';
                div.style.padding = '10px';
                div.style.background = 'white';
                div.style.borderRadius = '6px';
                div.style.border = `1px solid ${color}`;

                div.innerHTML = `
                    <p style="margin: 0 0 5px 0;"><strong>Soal ${i + 1}:</strong> ${decQ}</p>
                    <p style="margin: 0 0 5px 0; color: #16a34a;"><strong>Kunci Jawaban:</strong> ${decA}</p>
                    <p style="margin: 0; color: ${color};"><strong>Jawaban Anda:</strong> ${decSA}</p>
                `;
                decContainer.appendChild(div);
            });

            decContainer.classList.remove('hidden');
            document.getElementById('card-decrypt-result').style.display = 'none';

        } catch (e) {
            alert("Kunci Privat salah atau bukan angka yang valid!");
        }
    });

    loadState();
});
