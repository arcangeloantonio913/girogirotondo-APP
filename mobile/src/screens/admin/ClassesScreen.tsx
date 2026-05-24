import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { babyBlue:'#A7C7E7', white:'#FFFFFF', text:'#1A202C', muted:'#9CA3AF', border:'#F3F4F6', primary:'#4169E1', red:'#EF4444' };

export default function AdminClasses() {
  const { sede } = useAuth();
  const [classes,  setClasses]  = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [users,    setUsers]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClassName,   setNewClassName]   = useState('');
  const [saving,         setSaving]         = useState(false);
  const [editStudent,    setEditStudent]    = useState<any|null>(null);
  const [editForm,       setEditForm]       = useState<any>({});

  useEffect(()=>{
    Promise.all([api.get('/classes'),api.get('/students'),api.get('/users')])
      .then(([cR,sR,uR])=>{setClasses(cR.data||[]);setStudents(sR.data||[]);setUsers(uR.data||[]);})
      .catch(()=>{}).finally(()=>setLoading(false));
  },[sede]);

  const filtered = classes.filter(c => {
    if(!search) return true;
    const q = search.toLowerCase();
    const cs = students.filter(s=>s.class_id===c.id||s.class_ids?.includes(c.id));
    return c.name?.toLowerCase().includes(q) || cs.some(s=>`${s.name} ${s.cognome}`.toLowerCase().includes(q));
  });

  const handleCreate=async()=>{
    if(!newClassName.trim()){Alert.alert('Attenzione','Il nome è obbligatorio');return;}
    setSaving(true);
    try{
      const res=await api.post('/classes',{name:newClassName.trim()});
      setClasses(prev=>[...prev,res.data]);
      setShowCreateForm(false);setNewClassName('');
    }catch(e:any){Alert.alert('Errore',e?.response?.data?.detail||'Impossibile creare');}
    finally{setSaving(false);}
  };

  const handleDeleteClass=(id:string)=>{
    Alert.alert('Elimina classe','Sei sicuro? Gli alunni rimarranno nel sistema.',[
      {text:'Annulla',style:'cancel'},
      {text:'Elimina',style:'destructive',onPress:async()=>{
        try{await api.delete(`/classes/${id}`);setClasses(prev=>prev.filter(c=>c.id!==id));}
        catch{Alert.alert('Errore','Impossibile eliminare');}
      }},
    ]);
  };

  const handleAssignTeacher=(classId:string,teacherId:string|null)=>{
    api.patch(`/classes/${classId}`,{teacher_id:teacherId})
      .then(r=>setClasses(prev=>prev.map(c=>c.id===classId?{...c,...r.data}:c)))
      .catch(()=>Alert.alert('Errore','Impossibile assegnare maestra'));
  };

  const openEditStudent=(student:any)=>{
    setEditStudent(student);
    setEditForm({name:student.name||'',cognome:student.cognome||'',date_of_birth:student.date_of_birth||''});
  };

  const handleSaveStudent=async()=>{
    try{
      await api.patch(`/students/${editStudent.id}`,editForm);
      setStudents(prev=>prev.map(s=>s.id===editStudent.id?{...s,...editForm}:s));
      setEditStudent(null);
    }catch{Alert.alert('Errore','Impossibile salvare');}
  };

  const teachers = users.filter(u=>u.role==='teacher');

  return (
    <ScreenLayout title="Gestione Classi" showBack color={C.babyBlue} loading={loading} scrollable={false}>
      <FlatList
        data={filtered}
        keyExtractor={c=>c.id}
        contentContainerStyle={{padding:12}}
        ListHeaderComponent={
          <>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={{marginRight:8}}/>
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Cerca classe, bambino..." placeholderTextColor={C.muted}/>
            </View>
            <TouchableOpacity onPress={()=>setShowCreateForm(true)} style={s.addBtn}>
              <Ionicons name="add" size={18} color={C.white}/>
              <Text style={s.addBtnText}>Nuova Classe</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={<View style={{alignItems:'center',paddingTop:60}}><Text style={{fontSize:48}}>🏫</Text><Text style={{color:C.muted,marginTop:10}}>Nessuna classe</Text></View>}
        renderItem={({item})=>{
          const classStudents=students.filter(s=>s.class_id===item.id||s.class_ids?.includes(item.id));
          const teacher=users.find(u=>u.id===item.teacher_id);
          const isOpen=expanded===item.id;
          return(
            <View style={s.classCard}>
              <TouchableOpacity onPress={()=>setExpanded(isOpen?null:item.id)} style={s.classHeader}>
                <View style={s.classIcon}><Ionicons name="book-outline" size={22} color={C.babyBlue}/></View>
                <View style={{flex:1}}>
                  <Text style={s.className}>{item.name}</Text>
                  <Text style={s.classInfo}>
                    {teacher?`Maestra: ${teacher.name}`:'Nessuna maestra'} · {classStudents.length} alunni
                  </Text>
                </View>
                <TouchableOpacity onPress={()=>handleDeleteClass(item.id)} style={{padding:8}}>
                  <Ionicons name="trash-outline" size={16} color={C.red}/>
                </TouchableOpacity>
                <Ionicons name={isOpen?'chevron-up':'chevron-down'} size={16} color={C.muted}/>
              </TouchableOpacity>

              {isOpen&&(
                <View style={s.classBody}>
                  {/* Assegna maestra */}
                  <Text style={s.sectionLabel}>Maestra assegnata</Text>
                  <View style={s.teacherRow}>
                    {teacher
                      ? <><Text style={s.teacherName}>{teacher.name} {teacher.cognome}</Text>
                          <TouchableOpacity onPress={()=>handleAssignTeacher(item.id,null)} style={s.removeBtn}>
                            <Text style={{color:C.red,fontSize:12}}>Rimuovi</Text>
                          </TouchableOpacity>
                        </>
                      : <Text style={{color:C.muted,fontSize:12,fontStyle:'italic'}}>Nessuna maestra assegnata</Text>
                    }
                  </View>
                  {teachers.length>0&&(
                    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6}}>
                      {teachers.map(t=>(
                        <TouchableOpacity key={t.id} onPress={()=>handleAssignTeacher(item.id,t.id)}
                          style={[s.teacherChip,t.id===item.teacher_id&&s.teacherChipActive]}>
                          <Text style={[s.teacherChipText,t.id===item.teacher_id&&{color:C.white}]}>{t.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Lista bambini */}
                  <Text style={[s.sectionLabel,{marginTop:12}]}>Alunni ({classStudents.length})</Text>
                  {classStudents.length===0
                    ? <Text style={{color:C.muted,fontSize:12,fontStyle:'italic'}}>Nessun alunno in questa classe</Text>
                    : classStudents.map(st=>(
                        <TouchableOpacity key={st.id} onPress={()=>openEditStudent(st)} style={s.studentRow}>
                          <View style={s.studentAvatar}><Text style={{fontWeight:'700',color:C.primary}}>{st.name?.charAt(0)||'?'}</Text></View>
                          <View style={{flex:1}}>
                            <Text style={s.studentName}>{st.name} {st.cognome}</Text>
                            {st.date_of_birth&&<Text style={{fontSize:11,color:C.muted}}>{st.date_of_birth}</Text>}
                          </View>
                          <Ionicons name="pencil-outline" size={14} color={C.muted}/>
                        </TouchableOpacity>
                      ))
                  }
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Create form */}
      <Modal visible={showCreateForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setShowCreateForm(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuova Classe</Text>
            <TouchableOpacity onPress={()=>setShowCreateForm(false)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Nome classe *</Text>
          <TextInput style={s.input} value={newClassName} onChangeText={setNewClassName} placeholder="Es. Sezione Sole" autoFocus/>
          <TouchableOpacity style={[s.submitBtn,saving&&{opacity:0.6}]} onPress={handleCreate} disabled={saving}>
            <Text style={s.submitText}>{saving?'Creazione...':'Crea Classe'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit student */}
      <Modal visible={!!editStudent} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setEditStudent(null)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Modifica Bambino</Text>
            <TouchableOpacity onPress={()=>setEditStudent(null)}><Ionicons name="close" size={24} color={C.text}/></TouchableOpacity>
          </View>
          {[
            {key:'name',label:'Nome',ph:'Nome bambino'},
            {key:'cognome',label:'Cognome',ph:'Cognome'},
            {key:'date_of_birth',label:'Data di nascita',ph:'YYYY-MM-DD'},
          ].map(f=>(
            <View key={f.key}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput style={s.input} value={editForm[f.key]||''} onChangeText={t=>setEditForm((p:any)=>({...p,[f.key]:t}))} placeholder={f.ph}/>
            </View>
          ))}
          <TouchableOpacity style={s.submitBtn} onPress={handleSaveStudent}>
            <Text style={s.submitText}>Salva Modifiche</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const s=StyleSheet.create({
  searchRow:     {flexDirection:'row',alignItems:'center',backgroundColor:C.white,borderRadius:12,paddingHorizontal:12,marginBottom:10,borderWidth:0.5,borderColor:C.border,height:44},
  searchInput:   {flex:1,fontSize:14,color:C.text},
  addBtn:        {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.babyBlue,borderRadius:14,paddingVertical:12,marginBottom:12,justifyContent:'center'},
  addBtnText:    {color:C.white,fontWeight:'700',fontSize:14},
  classCard:     {backgroundColor:C.white,borderRadius:14,marginBottom:8,borderWidth:0.5,borderColor:C.border,overflow:'hidden'},
  classHeader:   {flexDirection:'row',alignItems:'center',padding:12,gap:10},
  classIcon:     {width:44,height:44,borderRadius:12,backgroundColor:'#EBF0FF',alignItems:'center',justifyContent:'center'},
  className:     {fontSize:15,fontWeight:'700',color:C.text},
  classInfo:     {fontSize:11,color:C.muted,marginTop:1},
  classBody:     {borderTopWidth:0.5,borderTopColor:C.border,padding:12},
  sectionLabel:  {fontSize:11,fontWeight:'700',color:C.muted,textTransform:'uppercase',marginBottom:6},
  teacherRow:    {flexDirection:'row',alignItems:'center',gap:10},
  teacherName:   {fontSize:13,fontWeight:'600',color:C.text,flex:1},
  removeBtn:     {paddingHorizontal:8,paddingVertical:4,borderRadius:8,borderWidth:0.5,borderColor:C.red},
  teacherChip:   {paddingHorizontal:10,paddingVertical:5,borderRadius:20,borderWidth:0.5,borderColor:C.border,backgroundColor:'#F9FAFB'},
  teacherChipActive:{backgroundColor:C.babyBlue,borderColor:C.babyBlue},
  teacherChipText:{fontSize:12,fontWeight:'600',color:C.muted},
  studentRow:    {flexDirection:'row',alignItems:'center',gap:8,paddingVertical:6,borderBottomWidth:0.5,borderBottomColor:C.border},
  studentAvatar: {width:32,height:32,borderRadius:16,backgroundColor:'#EBF0FF',alignItems:'center',justifyContent:'center'},
  studentName:   {fontSize:13,fontWeight:'600',color:C.text},
  modal:         {flex:1,padding:20,backgroundColor:'#FFFDD0'},
  modalHeader:   {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},
  modalTitle:    {fontSize:20,fontWeight:'800',color:C.text},
  fieldLabel:    {fontSize:13,fontWeight:'700',color:'#6B7280',marginBottom:6,marginTop:14},
  input:         {borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:C.text,backgroundColor:C.white},
  submitBtn:     {backgroundColor:C.babyBlue,borderRadius:14,paddingVertical:14,alignItems:'center',marginTop:20},
  submitText:    {color:C.white,fontWeight:'700',fontSize:15},
});
