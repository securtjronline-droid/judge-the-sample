from pathlib import Path
import numpy as np
import pandas as pd
import streamlit as st
import plotly.graph_objects as go
from sampling import draw, repeat, true_mean, allocation

st.set_page_config(page_title='Judge the Sample', page_icon='🩺', layout='wide')
st.title('🩺 Judge the Sample')
st.caption('Clinic waiting times · finite population of appointments in this CSV · minutes')
@st.cache_data
def load():
    return pd.read_csv(Path(__file__).parent / 'data' / 'clinic_visits.csv')
base = load()
truth = true_mean(base)
N = len(base)

with st.sidebar:
    st.header('Sampling settings')
    seed = st.number_input('Random seed', 0, 2_147_483_647, 2026, 1)
    n = st.slider('Sample size', 1, N, 100)
    method = st.selectbox('Sampling method', ['Simple random', 'Systematic', 'Stratified'])
    group = st.selectbox('Stratify by', ['visit_type', 'weekday', 'slot'])
    reps = st.number_input('Monte Carlo repetitions', min_value=1000, max_value=10000, value=1000, step=1000)
    st.caption('Same seed and settings reproduce the same selection. The CSV remains unchanged.')

st.info('**Population:** Each row is one simulated appointment, ordered chronologically by week, weekday, and appointment slot. The population is this file only—not every clinic or patient.')

s1, s2, s3 = st.tabs(['1 · Explore a sample', '2 · Compare methods and sizes', '3 · Your challenge'])
with s1:
    st.subheader('Population and selected appointments')
    rng = np.random.default_rng(int(seed))
    try:
        idx, estimate = draw(base, method, n, rng, group)
    except ValueError as exc:
        st.error(str(exc)); st.stop()
    a,b,c = st.columns(3)
    a.metric('True population mean', f'{truth:.2f} min')
    b.metric('Single sample estimate', f'{estimate:.2f} min')
    c.metric('Single sample error', f'{estimate-truth:+.2f} min')
    if method == 'Simple random':
        st.write('**Selection:** n distinct appointments, chosen uniformly without replacement. **Estimator:** ordinary sample mean.')
    elif method == 'Systematic':
        st.write(f'**Selection:** random start, then every {N/n:g} rows in chronological file order. '
                 + ('Whole-number interval.' if N % n == 0 else 'Fractional interval using ceiling positions.')
                 + ' **Estimator:** ordinary sample mean.')
    else:
        alloc = allocation(base, n, group)
        st.write(f'**Selection:** proportional allocation with at least one appointment per {group} stratum; random sampling without replacement within each. **Estimator:** weighted by each stratum’s share of the full population.')
        st.dataframe(pd.DataFrame({'Population rows': base.groupby(group).size(), 'Sample rows': alloc}), use_container_width=True)
    x = np.arange(1, N+1)
    fig = go.Figure()
    fig.add_trace(go.Scattergl(x=x, y=base.wait_time, mode='markers', name='Full population', marker=dict(size=3, color='#a5b4c6', opacity=.4)))
    fig.add_trace(go.Scattergl(x=x[idx], y=base.iloc[idx].wait_time, mode='markers', name='Selected appointments', marker=dict(size=7, color='#e26d45', opacity=.85)))
    fig.update_layout(title='Every appointment in file order (sample highlighted)', xaxis_title='Appointment number (chronological)', yaxis_title='Waiting time (minutes)', height=400, legend=dict(orientation='h'))
    st.plotly_chart(fig, use_container_width=True)
    st.write(f'**Selected rows:** {len(idx)} distinct appointments out of {N:,}.')
    st.dataframe(base.iloc[idx].assign(file_row=idx+1).sort_values('file_row'), use_container_width=True, height=250)

with s2:
    st.subheader('Repeated-sampling evidence')
    st.write('Experiment A compares three methods at **n = 100**. Experiment B compares simple random sampling at **n = 10, 100 and 640**. Each distribution shows repeated estimates; the dashed line is the true population mean.')
    if st.button('Run both experiments', type='primary'):
        with st.spinner('Simulating samples…'):
            results = {}
            for m in ['Simple random', 'Systematic', 'Stratified']:
                results[('Methods at n=100', m, 100)] = repeat(base, m, 100, int(seed), int(reps), group)
            for size in [10, 100, 640]:
                results[('Sample size', 'Simple random', size)] = (results[('Methods at n=100', 'Simple random', 100)] if size == 100 else repeat(base, 'Simple random', size, int(seed), int(reps), group))
        st.session_state['results'] = results
        st.session_state['run_settings'] = (int(seed), int(reps), group)
    results = st.session_state.get('results')
    if results:
        run_seed, run_reps, run_group = st.session_state['run_settings']
        if (int(seed), int(reps), group) != (run_seed, run_reps, run_group):
            st.warning('Controls changed since the last run. Press “Run both experiments” to update the evidence.')
        st.caption(f'Current results: baseline population · stratification={run_group} · Monte Carlo seed={run_seed}, repetitions={run_reps} · true mean={truth:.2f} min')
        records=[]
        for (exp, m, size), r in results.items():
            records.append({'Experiment': exp, 'Population': 'Baseline', 'Method': m, 'n': size, 'Strata': run_group if m=='Stratified' else '—', 'Seed': r['seed'], 'Runs / starts': r['runs'], 'Type': r['type'], 'Bias (min)': round(r['bias'], 4), 'SD (min)': round(r['SD'], 4), 'RMSE (min)': round(r['RMSE'], 4)})
        st.dataframe(pd.DataFrame(records), hide_index=True, use_container_width=True)
        st.download_button('Download results CSV', pd.DataFrame(records).to_csv(index=False), 'sampling_results.csv', 'text/csv')
        for exp in ['Methods at n=100', 'Sample size']:
            st.markdown('#### ' + ('Experiment A · Methods at n = 100' if exp.startswith('Methods') else 'Experiment B · Sample size'))
            fig = go.Figure()
            for (e,m,size), r in results.items():
                if e != exp: continue
                label = m if exp.startswith('Methods') else f'SRS n={size}'
                fig.add_trace(go.Histogram(x=r['estimates'], name=f'{label} ({r["type"]}, {r["runs"]})', opacity=.5, histnorm='probability density', nbinsx=45))
            fig.add_vline(x=truth, line_dash='dash', line_color='black', annotation_text='True population mean')
            fig.update_layout(barmode='overlay', xaxis_title='Estimated mean waiting time (minutes)', yaxis_title='Density', height=370)
            st.plotly_chart(fig, use_container_width=True)
        st.caption('Bias = average estimate − true mean; SD = spread of estimates (population divisor); RMSE = square root of average squared estimation error. Exact systematic results enumerate all starts when the interval is whole-number.')
    else:
        st.info('Press “Run both experiments” to generate and inspect your own evidence.')

with s3:
    st.subheader('Stage 5 · Your challenge')
    st.write('Write your own hypothesis and what evidence would contradict it in **DECISIONS.md**, section 5, before asking your agent to design challenge controls. This stage is intentionally not preselected for you.')
    st.write('Once your hypothesis is recorded, provide the method, proposed condition change, and alternative method or correction so the baseline-versus-modified test can be implemented without changing the sampling rules.')
