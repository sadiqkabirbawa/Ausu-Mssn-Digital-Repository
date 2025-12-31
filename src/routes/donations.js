const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Donation } = require('../models');
const notificationService = require('../services/notificationService');
const layoutHook = require('../views/_layout_hook');

const router = express.Router();
router.use(layoutHook);

router.get('/', async (req, res) => {
  const donations = await Donation.findAll({ where: { status: 'SUCCESS' }, order: [['createdAt','DESC']], limit: 20 });
  res.render('donations/home', { title: 'Donate', donations });
});

function randomRef(){ return crypto.randomBytes(8).toString('hex'); }

router.post('/init', async (req, res) => {
  const { fullName, email, amount } = req.body;
  if (!fullName || !email || !amount) { req.flash('error','All fields required.'); return res.redirect('/donations'); }
  const ref = randomRef();
  await Donation.create({ fullName, email, amount: parseInt(amount,10), reference: ref });
  try {
    const initUrl = 'https://api.paystack.co/transaction/initialize';
    const callback_url = `${process.env.BASE_URL || 'http://127.0.0.1:3000'}/donations/verify`;
    const resp = await axios.post(initUrl, { email, amount: parseInt(amount,10) * 100, reference: ref, callback_url }, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    if (resp.data?.status && resp.data.data?.authorization_url) return res.redirect(resp.data.data.authorization_url);
  } catch (e) { console.error(e?.response?.data || e.message); }
  req.flash('error','Failed to initialize payment.'); res.redirect('/donations');
});

router.get('/verify', async (req, res) => {
  const ref = req.query.reference;
  if (!ref) { req.flash('error','No reference.'); return res.redirect('/donations'); }
  try {
    const verifyUrl = `https://api.paystack.co/transaction/verify/${ref}`;
    const resp = await axios.get(verifyUrl, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const status = resp.data?.data?.status;
    const d = await Donation.findOne({ where: { reference: ref } });
    if (!d) { req.flash('error','Donation not found.'); return res.redirect('/donations'); }
    if (status === 'success') { 
      await d.update({ status: 'SUCCESS' }); 
      
      // Send notification about successful donation
      await notificationService.notifyDonationReceived(d.id);
      
      req.flash('success','Payment successful. Thank you!'); 
    }
    else { await d.update({ status: 'FAILED' }); req.flash('error','Payment failed or not verified.'); }
  } catch (e) { console.error(e?.response?.data || e.message); req.flash('error','Verification failed.'); }
  res.redirect('/donations');
});

router.post('/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try { 
    const ev = req.body; 
    if (ev?.event === 'charge.success') { 
      const ref = ev.data?.reference; 
      if (ref) { 
        const d = await Donation.findOne({ where: { reference: ref } }); 
        if (d) {
          await d.update({ status: 'SUCCESS' });
          
          // Send notification about successful donation
          await notificationService.notifyDonationReceived(d.id);
        }
      } 
    } 
  }
  catch {}
  res.json({ ok: true });
});

module.exports = router;
