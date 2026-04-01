$(document).ready(function() {
    let transactions = JSON.parse(localStorage.getItem('revou_data')) || [];
    let myChart = null;

    // --- 1. DARK MODE LOGIC ---
    if (localStorage.getItem('theme') === 'dark') toggleDark(true);

    $('#darkModeBtn').click(function() {
        const isDark = !$('body').hasClass('dark-mode');
        toggleDark(isDark);
    });

    function toggleDark(isDark) {
        if (isDark) {
            $('body').addClass('dark-mode');
            $('#darkModeBtn i').removeClass('fa-moon').addClass('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            $('body').removeClass('dark-mode');
            $('#darkModeBtn i').removeClass('fa-sun').addClass('fa-moon');
            localStorage.setItem('theme', 'light');
        }
        if (myChart) renderChart(); // Update chart colors
    }

    // --- 2. CATEGORY LOGIC ---
    $('#category').change(function() {
        if ($(this).val() === 'Custom') $('#customCatWrapper').removeClass('d-none');
        else $('#customCatWrapper').addClass('d-none');
    });

    // --- 3. FORM SUBMISSION ---
    $('#transactionForm').submit(function(e) {
        e.preventDefault();
        
        const name = $('#item').val();
        const amount = parseFloat($('#amount').val());
        const type = $('#type').val();
        let cat = $('#category').val();

        // 1. Hitung total saldo yang ada saat ini di LocalStorage/Variable
        let currentBalance = 0;
        transactions.forEach(t => {
            if (t.type === 'income') currentBalance += t.amount;
            else currentBalance -= t.amount;
        });

        // 2. Cek: Jika tipe-nya 'expense' tapi saldo tidak mencukupi
        if (type === 'expense' && (currentBalance - amount) < 0) {
            Swal.fire({
                icon: 'error',
                title: 'Saldo Tidak Cukup!',
                text: `Saldo saat ini $${currentBalance.toFixed(2)}. Silakan tambah pemasukan terlebih dahulu!`,
                confirmButtonColor: '#d33'
            });
            return; // Hentikan eksekusi, data tidak akan di-push
        }

        if (cat === 'Custom') cat = $('#customCategory').val() || 'Other';

        transactions.push({ id: Date.now(), name, amount, type, cat });
        
        localStorage.setItem('revou_data', JSON.stringify(transactions));
        
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Disimpan!',
            showConfirmButton: false,
            timer: 1000
        });

        this.reset();
        $('#customCatWrapper').addClass('d-none');
        renderUI();
    });

    // --- 4. DELETE LOGIC ---
    window.deleteItem = (id) => {
        // 1. Cari data yang mau dihapus
        const itemToDelete = transactions.find(t => t.id === id);
        if (!itemToDelete) return;

        // 2. Simulasi hitung saldo jika data ini dihapus
        let simulatedBalance = 0;
        transactions.forEach(t => {
            if (t.id === id) return; // Skip data yang mau dihapus dalam simulasi
            if (t.type === 'income') simulatedBalance += t.amount;
            else simulatedBalance -= t.amount;
        });

        // 3. Validasi: Jika penghapusan mengakibatkan saldo minus
        if (simulatedBalance < 0) {
            Swal.fire({
                icon: 'error',
                title: 'Pemasukan tidak bisa dihapus!',
                text: `Data ini tidak bisa dihapus karena saldo Anda akan menjadi minus ($${simulatedBalance.toFixed(2)}). Hapus dulu pengeluaran yang berkaitan!`,
                confirmButtonColor: '#d33'
            });
            return; // Blokir proses penghapusan
        }

        // 4. Jika aman, baru munculkan konfirmasi hapus seperti biasa
        Swal.fire({
            title: 'Hapus data ini?',
            text: `Item: ${itemToDelete.name}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus!'
        }).then((result) => {
            if (result.isConfirmed) {
                transactions = transactions.filter(t => t.id !== id);
                localStorage.setItem('revou_data', JSON.stringify(transactions));
                renderUI();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Dihapus!',
                    timer: 800,
                    showConfirmButton: false
                });
            }
        });
    };

    // --- 5. RENDER UI ---
    function renderUI() {
        const list = $('#transactionList');
        const monitoring = $('#monitoringSection');
        
        list.empty();
    
        // --- LOGIKA HIDE/SHOW ---
        if (transactions.length > 0) {
            monitoring.removeClass('d-none').hide().fadeIn(500); // Muncul dengan animasi halus
        } else {
            monitoring.addClass('d-none'); // Sembunyi jika kosong
        }

        let total = 0;

        // Render List & Calculate Balance
        transactions.forEach(t => {
            if (t.type === 'income') total += t.amount;
            else total -= t.amount;

            list.append(`
                <div class="transaction-item d-flex justify-content-between align-items-center">
                    <div>
                        <p class="mb-0 fw-bold">${t.name}</p>
                        <p class="mb-0 fw-bold ${t.type === 'income' ? 'text-success' : 'text-primary'}">
                            ${t.type === 'income' ? '+' : ''}$${t.amount.toFixed(2)}
                        </p>
                        <span class="badge-cat">${t.cat}</span>
                    </div>
                    <div class="text-end">
                        <button class="btn btn-danger text-light" onclick="deleteItem(${t.id})">Delete</button>
                    </div>
                </div>
            `);
        });

        // Update Balance Display
        const balanceEl = $('#totalBalance');
        balanceEl.text(`$${Math.abs(total).toFixed(2)}`);
        
        // Requirement: Jika 0 wajib text-danger
        if (total === 0) {
            balanceEl.removeClass('text-primary text-success').addClass('text-danger');
        } else if (total < 0) {
            balanceEl.text(`-$${Math.abs(total).toFixed(2)}`).addClass('text-danger').removeClass('text-primary');
        } else {
            balanceEl.addClass('text-primary').removeClass('text-danger');
        }

        renderChart();
    }

    // 6. --- CHART LOGIC ---
    function renderChart() {
        const chartContainer = $('#expenseChart').parent(); // Ambil pembungkus canvas
        const ctx = document.getElementById('expenseChart').getContext('2d');
        
        // Filter hanya transaksi tipe 'expense'
        const expenseData = transactions.filter(t => t.type === 'expense');
        
        // --- LOGIKA EMPTY STATE CHART ---
        if (expenseData.length === 0) {
            // Jika tidak ada pengeluaran, sembunyikan canvas dan tampilkan pesan
            $('#expenseChart').hide(); 
            if ($('#chartPlaceholder').length === 0) {
                chartContainer.append(`
                    <div id="chartPlaceholder" class="text-center py-5">
                        <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                        <p class="text-muted small">Belum ada data pengeluaran untuk divisualisasikan.</p>
                    </div>
                `);
            }
            return; // Keluar dari fungsi, jangan gambar chart
        } else {
            // Jika ada data pengeluaran, tampilkan kembali canvas dan hapus placeholder
            $('#expenseChart').show();
            $('#chartPlaceholder').remove();
        }

        // --- PROSES DATA CHART SEPERTI BIASA ---
        const summary = {};
        expenseData.forEach(t => {
            summary[t.cat] = (summary[t.cat] || 0) + t.amount;
        });

        if (myChart) myChart.destroy();

        const isDark = $('body').hasClass('dark-mode');
        myChart = new Chart(ctx, {
            type: 'doughnut', // Doughnut kelihatan lebih modern dibanding Pie biasa
            data: {
                labels: Object.keys(summary),
                datasets: [{
                    data: Object.values(summary),
                    backgroundColor: ['#2ecc71', '#3498db', '#e67e22', '#e74c3c', '#9b59b6', '#f1c40f'],
                    borderColor: isDark ? '#1e1e1e' : '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: isDark ? '#fff' : '#666', font: { size: 11, family: 'Inter' } }
                    }
                }
            }
        });
    }

    renderUI();
});
