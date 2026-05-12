import React, { useState } from 'react';

export default function ProductDraftPage() {
 const [draft, setDraft] = useState({
   title: '',
   description: '',
   price: '',
   condition: 'used'
 });

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
   setDraft({ ...draft, [e.target.name]: e.target.value });
 };

 return (
   <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
     <h2>KAUF-AI</h2>
     <p style={{ fontSize: '10px' }}>PICTURE ◈ POST ◈ SELL</p>

     <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
       <label>Product Title</label>
       <input name="title" value={draft.title} onChange={handleChange} style={{ padding: '10px' }} />

       <label>Description</label>
       <textarea name="description" value={draft.description} onChange={handleChange} style={{ height: '80px', padding: '10px' }} />

       <div style={{ display: 'flex', gap: '10px' }}>
         <div style={{ flex: 1 }}>
           <label>Price</label>
           <input name="price" type="number" value={draft.price} onChange={handleChange} style={{ width: '100%', padding: '10px' }} />
         </div>
         <div style={{ flex: 1 }}>
           <label>Condition</label>
           <select name="condition" value={draft.condition} onChange={handleChange} style={{ width: '100%', padding: '10px' }}>
             <option value="new">New</option>
             <option value="used">Used</option>
           </select>
         </div>
       </div>

       <button type="button" style={{ backgroundColor: '#000', color: '#fff', padding: '15px', marginTop: '10px', border: 'none', borderRadius: '5px' }}>
         POST TO MARKETPLACES
       </button>
     </div>
   </div>
 );
}
