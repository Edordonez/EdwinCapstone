# Amadeus Flight APIs - 권장 API 가이드

이 문서는 개인화된 여행 챗봇 프로젝트에 유용한 Amadeus Flight API들을 정리한 것입니다.

## 현재 사용 중인 API

1. **Flight Availabilities Search** (`/v2/shopping/flight-offers`)
   - 기본 항공편 검색
   - 이미 구현됨: `search_flights()`

2. **Flight Inspiration Search** (`/v1/shopping/flight-destinations`)
   - 목적지 추천
   - 이미 구현됨: `get_flight_inspiration()`

3. **Flight Cheapest Date Search** (`/v1/shopping/flight-dates`)
   - 최저가 날짜 검색
   - 이미 구현됨: `get_cheapest_dates()`

4. **Airport & City Search** (`/v1/reference-data/locations`)
   - 공항/도시 검색
   - 이미 구현됨: `get_airport_city_search()`

## 새로 추가된 권장 API

### 1. **Flight Price Analysis** (가격 분석) ⭐⭐⭐
**API**: `/v2/analytics/itinerary-price-metrics`  
**메서드**: `get_flight_price_analysis()`

**용도**:
- 가격 트렌드 분석 및 예측
- 최적 예약 시기 추천
- 사용자에게 "지금 예약할지, 나중에 예약할지" 조언

**사용 예시**:
```python
price_analysis = amadeus_service.get_flight_price_analysis(
    origin="IAD",
    destination="BCN",
    departure_date="2025-11-13",
    return_date="2025-11-16"
)
# 반환: 최저가, 평균가, 가격 변동성, 추천사항
```

**프로젝트 통합 위치**:
- 항공편 검색 결과와 함께 가격 분석 제공
- 사용자가 온보딩에서 "Budget"을 높게 설정한 경우 특히 유용

---

### 2. **Flight Choice Prediction** (선택 예측) ⭐⭐⭐⭐⭐
**API**: `/v2/shopping/flight-offers/prediction`  
**메서드**: `get_flight_choice_prediction()`

**용도**:
- 사용자 선호도(Budget, Quality, Convenience) 기반 항공편 추천
- 개인화된 항공편 순위 매기기
- 온보딩 폼의 선호도와 연계 가능

**사용 예시**:
```python
predictions = amadeus_service.get_flight_choice_prediction(
    origin="IAD",
    destination="BCN",
    departure_date="2025-11-13",
    return_date="2025-11-16",
    cabin_class="ECONOMY"
)
# 반환: 각 항공편의 선호도 점수와 추천 메시지
```

**프로젝트 통합 위치**:
- 온보딩 폼에서 수집한 사용자 선호도와 함께 사용
- `flight_formatter.py`의 정렬 로직과 통합
- 현재는 가격 순으로 정렬하지만, 선호도 점수로 정렬하도록 변경 가능

---

### 3. **Flight Delay Prediction** (지연 예측) ⭐⭐⭐⭐
**API**: `/v1/travel/predictions/flight-delay`  
**메서드**: `get_flight_delay_prediction()`

**용도**:
- 항공편 지연 확률 예측
- 사용자에게 위험도 알림
- 연결편 예약 시 조언

**사용 예시**:
```python
delay_prediction = amadeus_service.get_flight_delay_prediction(
    origin="IAD",
    destination="BCN",
    departure_date="2025-11-13",
    departure_time="18:00:00",
    carrier_code="UA",
    flight_number="991"
)
# 반환: 지연 확률, 위험도, 추천사항
```

**프로젝트 통합 위치**:
- 항공편 검색 결과에 지연 위험도 표시
- "Convenience"를 중요하게 생각하는 사용자에게 특히 유용

---

### 4. **SeatMap Display** (좌석맵) ⭐⭐
**API**: `/v1/shopping/seatmaps`  
**메서드**: `get_seatmap_display()`

**용도**:
- 항공편 선택 후 좌석 선택 기능
- 좌석 배치도 표시

**사용 예시**:
```python
seatmap = amadeus_service.get_seatmap_display(
    flight_offer_id="offer_id_here"
)
# 반환: 좌석 배치도, 사용 가능한 좌석 정보
```

**프로젝트 통합 위치**:
- 항공편 선택 후 다음 단계로 좌석 선택 기능 제공
- "Quality"를 중요하게 생각하는 사용자에게 프리미엄 좌석 추천

---

### 5. **Branded Fares** (브랜드 요금) ⭐⭐
**API**: `/v2/shopping/flight-offers` (with `view=DELTA`)  
**메서드**: `get_branded_fares()`

**용도**:
- 다양한 서비스 옵션이 포함된 요금 제공
- 기본, 플렉스, 비즈니스 등 다양한 요금 옵션

**사용 예시**:
```python
branded_fares = amadeus_service.get_branded_fares(
    origin="IAD",
    destination="BCN",
    departure_date="2025-11-13",
    return_date="2025-11-16"
)
# 반환: 다양한 서비스 옵션이 포함된 요금 정보
```

**프로젝트 통합 위치**:
- 사용자가 "Quality" 또는 "Convenience"를 중요하게 생각하는 경우 더 많은 서비스 옵션 제공

---

## 우선순위 추천

### 즉시 통합 권장 (High Priority)

1. **Flight Choice Prediction** ⭐⭐⭐⭐⭐
   - 온보딩 폼의 사용자 선호도와 직접 연계 가능
   - 개인화된 추천의 핵심 기능
   - `flight_formatter.py`의 정렬 로직 개선에 사용

2. **Flight Price Analysis** ⭐⭐⭐
   - Budget 선호도를 가진 사용자에게 유용
   - 가격 트렌드 정보 제공으로 사용자 만족도 향상

### 중기 통합 권장 (Medium Priority)

3. **Flight Delay Prediction** ⭐⭐⭐⭐
   - Convenience 선호도를 가진 사용자에게 유용
   - 실용적인 정보 제공

### 장기 통합 권장 (Low Priority)

4. **SeatMap Display** ⭐⭐
   - 항공편 선택 후 추가 기능
   - UI 복잡도 증가

5. **Branded Fares** ⭐⭐
   - Quality 선호도를 가진 사용자에게 유용
   - 추가 서비스 옵션 제공

---

## 통합 방법

### 1. Flight Choice Prediction 통합 예시

`backend/main.py`의 `/api/chat` 엔드포인트에서:

```python
# 사용자 선호도 가져오기 (온보딩 폼에서 수집)
user_preferences = get_user_preferences_from_session(session_id)

# 항공편 검색 후 선택 예측 적용
if user_preferences:
    predictions = amadeus_service.get_flight_choice_prediction(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date,
        cabin_class="ECONOMY"
    )
    
    # 예측 점수를 항공편 데이터에 추가
    # flight_formatter.py에서 선호도 점수로 정렬
```

### 2. 사용자 선호도 기반 정렬 개선

`backend/services/flight_formatter.py`에서:

```python
def format_flight_for_dashboard(
    flight_data: Dict[str, Any],
    origin_city: str,
    dest_city: str,
    origin_code: str,
    dest_code: str,
    departure_date: str,
    return_date: Optional[str] = None,
    user_preferences: Optional[Dict[str, float]] = None  # 새로 추가
) -> Dict[str, Any]:
    # ... 기존 코드 ...
    
    # 사용자 선호도가 있으면 가중치 점수로 정렬
    if user_preferences:
        budget_weight = user_preferences.get('budget', 0.33)
        quality_weight = user_preferences.get('quality', 0.33)
        convenience_weight = user_preferences.get('convenience', 0.34)
        
        # 각 항공편에 점수 계산
        for flight in formatted_response["outboundFlights"]:
            score = calculate_preference_score(
                flight, budget_weight, quality_weight, convenience_weight
            )
            flight['preferenceScore'] = score
        
        # 점수로 정렬
        formatted_response["outboundFlights"].sort(
            key=lambda x: x.get('preferenceScore', 0), 
            reverse=True
        )
    else:
        # 기본적으로 가격 순으로 정렬
        formatted_response["outboundFlights"].sort(key=lambda x: x["price"])
```

---

## 다음 단계

1. **Flight Choice Prediction API 테스트 및 통합**
   - API 응답 형식 확인
   - 온보딩 폼의 선호도와 연계

2. **가격 분석 기능 추가**
   - 항공편 검색 결과에 가격 트렌드 정보 표시
   - "지금 예약할지, 나중에 예약할지" 추천

3. **지연 예측 정보 표시**
   - 항공편 검색 결과에 지연 위험도 표시
   - 위험도가 높은 경우 경고 메시지

---

## 참고 자료

- [Amadeus API Documentation](https://developers.amadeus.com/)
- [Flight APIs Overview](https://developers.amadeus.com/self-service/category/air)
